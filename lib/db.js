import pg from 'pg';

import { SLUGS, envioEfetivo, foiEditado } from './envio.js';

const { Pool } = pg;

const URL_BANCO = process.env.DATABASE_URL;

export const temBanco = Boolean(URL_BANCO);

/**
 * O Postgres interno do Railway (*.railway.internal) fala sem TLS.
 * Qualquer outro host — inclusive o proxy público do próprio Railway —
 * exige TLS, e o certificado é auto-assinado.
 */
const interno = temBanco
  && (/\.railway\.internal/.test(URL_BANCO) || /localhost|127\.0\.0\.1/.test(URL_BANCO));

export const pool = temBanco
  ? new Pool({
      connectionString: URL_BANCO,
      ssl: interno ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

pool?.on('error', (err) => console.error('[postgres] erro no pool:', err.message));

/** Descreve a conexão sem vazar a senha nos logs. */
export function descreverConexao() {
  if (!temBanco) return 'DATABASE_URL ausente';
  try {
    const u = new URL(URL_BANCO);
    return `${u.hostname}:${u.port || 5432}${u.pathname} (TLS ${interno ? 'off' : 'on'})`;
  } catch {
    return 'DATABASE_URL malformada';
  }
}

/**
 * Cria a tabela e os índices se ainda não existirem.
 * Roda uma vez, no boot do servidor.
 */
/**
 * Espera o Postgres aceitar conexão.
 * Num deploy novo o banco costuma subir junto com o app, então uma
 * recusa nos primeiros segundos é normal e não deve derrubar o serviço.
 */
export async function esperarBanco({ tentativas = 8, esperaMs = 2000 } = {}) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      const ultima = i === tentativas;
      if (ultima) throw err;
      console.log(`  Postgres ainda não respondeu (${i}/${tentativas}), tentando de novo...`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}

export async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id                  SERIAL PRIMARY KEY,
      criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),

      -- etapa 1: contato
      nome                TEXT        NOT NULL,
      email               TEXT        NOT NULL,
      whatsapp            TEXT        NOT NULL,
      whatsapp_digitos    TEXT        NOT NULL,

      -- etapa 2: entrega
      cep                 TEXT        NOT NULL,
      uf                  CHAR(2)     NOT NULL,
      cidade              TEXT        NOT NULL,
      endereco            TEXT        NOT NULL,
      numero              TEXT        NOT NULL,
      complemento         TEXT,
      bairro              TEXT,

      -- etapa 3: adesivos
      adesivo_carro       TEXT        NOT NULL,
      qtd_carros          SMALLINT    NOT NULL DEFAULT 0,
      adesivo_moto        TEXT        NOT NULL,
      qtd_motos           SMALLINT    NOT NULL DEFAULT 0,

      -- etapa 4: perfil de engajamento
      disponibilidade     TEXT        NOT NULL,
      contatos            TEXT        NOT NULL,
      distribuidores      TEXT        NOT NULL,
      mora_condominio     TEXT        NOT NULL,
      unidades_condominio INTEGER,

      -- etapa 5: kit
      kit                 TEXT        NOT NULL,
      kit_recomendado     TEXT        NOT NULL,
      engajamento         SMALLINT    NOT NULL DEFAULT 0,

      -- etapa 6: consentimento e operação
      aceite_lgpd         BOOLEAN     NOT NULL DEFAULT false,
      status              TEXT        NOT NULL DEFAULT 'novo',
      observacoes         TEXT,
      ip                  TEXT,
      user_agent          TEXT,

      -- conferência antifraude, feita por gente no painel
      revisao             TEXT        NOT NULL DEFAULT 'pendente',
      revisado_por        TEXT,
      revisado_em         TIMESTAMPTZ,

      -- quantidades ajustadas à mão; nulo = usa o padrão do kit (lib/envio.js)
      envio               JSONB,

      CONSTRAINT status_valido CHECK (
        status IN ('novo', 'separado', 'enviado', 'entregue', 'cancelado')
      ),
      CONSTRAINT revisao_valida CHECK (
        revisao IN ('pendente', 'aprovado', 'suspeito')
      )
    );
  `);

  // Bancos criados antes da conferência antifraude existir.
  await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS revisao      TEXT NOT NULL DEFAULT 'pendente'`);
  await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS revisado_por TEXT`);
  await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS revisado_em  TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio        JSONB`);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE pedidos ADD CONSTRAINT revisao_valida
        CHECK (revisao IN ('pendente', 'aprovado', 'suspeito'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_criado ON pedidos (criado_em DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_local  ON pedidos (uf, cidade);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_fila   ON pedidos (engajamento DESC, criado_em DESC);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_wpp ON pedidos (whatsapp_digitos);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_revisao ON pedidos (revisao);`);

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM pedidos`);
  console.log(`  Banco pronto — ${rows[0].n} pedido(s) na base.`);
}

const COLUNAS = [
  'nome', 'email', 'whatsapp', 'whatsapp_digitos',
  'cep', 'uf', 'cidade', 'endereco', 'numero', 'complemento', 'bairro',
  'adesivo_carro', 'qtd_carros', 'adesivo_moto', 'qtd_motos',
  'disponibilidade', 'contatos', 'distribuidores', 'mora_condominio', 'unidades_condominio',
  'kit', 'kit_recomendado', 'engajamento',
  'aceite_lgpd', 'ip', 'user_agent',
];

const SQL_INSERT = `
  INSERT INTO pedidos (${COLUNAS.join(', ')})
  VALUES (${COLUNAS.map((_, i) => `$${i + 1}`).join(', ')})
  RETURNING id, criado_em
`;

/** Insere um pedido. Lança erro com codigo 'DUPLICADO' se o WhatsApp já existe. */
export async function criarPedido(dados) {
  const valores = COLUNAS.map((c) => {
    const v = dados[c];
    return v === undefined || v === '' ? null : v;
  });

  try {
    const { rows } = await pool.query(SQL_INSERT, valores);
    return { id: rows[0].id, criado_em: rows[0].criado_em };
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('Já existe um pedido para este WhatsApp.');
      e.codigo = 'DUPLICADO';
      throw e;
    }
    throw err;
  }
}

/**
 * Sinais de fraude, contados sobre a tabela inteira.
 *
 * As janelas ficam numa subconsulta porque precisam enxergar todos os pedidos,
 * não só a página pedida — senão o 3º pedido de um mesmo IP passaria limpo por
 * estar na página seguinte.
 *
 * IP nulo não conta: `PARTITION BY` juntaria todos os nulos num grupo só e
 * marcaria a base inteira. Endereço repetido compara a porta exata (CEP +
 * número + complemento), então prédio com apartamentos diferentes não acusa.
 */
const SQL_SINAIS = `
  SELECT
    p.*,
    (CASE WHEN p.ip IS NULL THEN 0
          ELSE COUNT(*) OVER (PARTITION BY p.ip) - 1 END)::int             AS n_mesmo_ip,
    (COUNT(*) OVER (
      PARTITION BY p.cep, lower(p.endereco), p.numero, COALESCE(p.complemento, '')
    ) - 1)::int                                                            AS n_mesmo_endereco,
    (COUNT(*) OVER (PARTITION BY lower(p.nome))  - 1)::int                 AS n_mesmo_nome,
    (COUNT(*) OVER (PARTITION BY lower(p.email)) - 1)::int                 AS n_mesmo_email
  FROM pedidos p
`;

export async function listarPedidos({
  limite = 200, offset = 0, status = null, revisao = null,
} = {}) {
  const filtros = [];
  const valores = [];

  if (status) filtros.push(`t.status = $${valores.push(status)}`);
  if (revisao) filtros.push(`t.revisao = $${valores.push(revisao)}`);

  const { rows } = await pool.query(`
    SELECT * FROM (${SQL_SINAIS}) t
    ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
    ORDER BY t.engajamento DESC, t.criado_em DESC
    LIMIT $${valores.push(limite)} OFFSET $${valores.push(offset)}
  `, valores);

  return rows;
}

/** Marca o pedido como conferido (ou suspeito), guardando quem conferiu. */
export async function atualizarRevisao(id, revisao, observacoes, porQuem) {
  await pool.query(
    `UPDATE pedidos
        SET revisao = $1,
            observacoes = COALESCE($2, observacoes),
            revisado_por = $3,
            revisado_em = now()
      WHERE id = $4`,
    [revisao, observacoes, porQuem, id]);
}

export async function contarPedidos() {
  const [total, porKit, porUf, adesivos, porRevisao, sinais] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM pedidos`),
    pool.query(`SELECT kit, COUNT(*)::int AS n FROM pedidos GROUP BY kit ORDER BY n DESC`),
    pool.query(`SELECT uf,  COUNT(*)::int AS n FROM pedidos GROUP BY uf  ORDER BY n DESC`),
    pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN adesivo_carro = 'quero' THEN qtd_carros ELSE 0 END), 0)::int AS carros,
        COALESCE(SUM(CASE WHEN adesivo_moto  = 'quero' THEN qtd_motos  ELSE 0 END), 0)::int AS motos
      FROM pedidos`),
    pool.query(`SELECT revisao, COUNT(*)::int AS n FROM pedidos GROUP BY revisao`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE n_mesmo_ip > 0)::int        AS ip_repetido,
        COUNT(*) FILTER (WHERE n_mesmo_endereco > 0)::int  AS endereco_repetido,
        COUNT(*) FILTER (WHERE n_mesmo_nome > 0)::int      AS nome_repetido,
        COUNT(*) FILTER (WHERE n_mesmo_email > 0)::int     AS email_repetido
      FROM (${SQL_SINAIS}) t`),
  ]);

  const revisao = Object.fromEntries(porRevisao.rows.map((l) => [l.revisao, l.n]));

  return {
    total: total.rows[0].n,
    porKit: porKit.rows,
    porUf: porUf.rows,
    adesivos: adesivos.rows[0],
    revisao: {
      pendente: revisao.pendente || 0,
      aprovado: revisao.aprovado || 0,
      suspeito: revisao.suspeito || 0,
    },
    sinais: sinais.rows[0],
  };
}

export async function atualizarStatus(id, status) {
  await pool.query(`UPDATE pedidos SET status = $1 WHERE id = $2`, [status, id]);
}

/**
 * Exporta todos os pedidos em CSV (separador ; para o Excel pt-BR).
 *
 * A coluna `envio` (JSON) é trocada por uma coluna `env_<item>` para cada item
 * do catálogo, já com o valor que vale de fato — ajustado à mão quando houve
 * ajuste, senão o padrão do kit. É esse formato que o sistema de logística lê:
 * número puro por coluna, sem precisar interpretar JSON.
 */
export async function exportarCsv() {
  const { rows, fields } = await pool.query(`SELECT * FROM pedidos ORDER BY id`);

  const colunas = fields.map((f) => f.name).filter((c) => c !== 'envio');
  const cabecalho = [
    ...colunas,
    ...SLUGS.map((s) => `env_${s}`),
    'envio_editado',
  ];

  const escapar = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };

  const linhaDe = (l) => {
    const envio = envioEfetivo(l);
    return [
      ...colunas.map((c) => escapar(l[c])),
      ...SLUGS.map((s) => envio[s]),
      foiEditado(l) ? 'sim' : 'nao',
    ].join(';');
  };

  return [cabecalho.join(';'), ...rows.map(linhaDe)].join('\n');
}

/** Grava as quantidades ajustadas. `envio` nulo volta o pedido para o padrão. */
export async function atualizarEnvio(id, envio) {
  await pool.query(
    `UPDATE pedidos SET envio = $1 WHERE id = $2`,
    [envio ? JSON.stringify(envio) : null, id]);
}

export async function fecharBanco() {
  await pool.end();
}
