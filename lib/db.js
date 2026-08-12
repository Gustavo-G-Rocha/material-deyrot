import pg from 'pg';

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

      CONSTRAINT status_valido CHECK (
        status IN ('novo', 'separado', 'enviado', 'entregue', 'cancelado')
      )
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_criado ON pedidos (criado_em DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_local  ON pedidos (uf, cidade);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_fila   ON pedidos (engajamento DESC, criado_em DESC);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_wpp ON pedidos (whatsapp_digitos);`);

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
  RETURNING id
`;

/** Insere um pedido. Lança erro com codigo 'DUPLICADO' se o WhatsApp já existe. */
export async function criarPedido(dados) {
  const valores = COLUNAS.map((c) => {
    const v = dados[c];
    return v === undefined || v === '' ? null : v;
  });

  try {
    const { rows } = await pool.query(SQL_INSERT, valores);
    return { id: rows[0].id };
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('Já existe um pedido para este WhatsApp.');
      e.codigo = 'DUPLICADO';
      throw e;
    }
    throw err;
  }
}

export async function listarPedidos({ limite = 200, offset = 0, status = null } = {}) {
  const { rows } = status
    ? await pool.query(
        `SELECT * FROM pedidos WHERE status = $1
         ORDER BY engajamento DESC, criado_em DESC LIMIT $2 OFFSET $3`,
        [status, limite, offset])
    : await pool.query(
        `SELECT * FROM pedidos
         ORDER BY engajamento DESC, criado_em DESC LIMIT $1 OFFSET $2`,
        [limite, offset]);
  return rows;
}

export async function contarPedidos() {
  const [total, porKit, porUf, adesivos] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM pedidos`),
    pool.query(`SELECT kit, COUNT(*)::int AS n FROM pedidos GROUP BY kit ORDER BY n DESC`),
    pool.query(`SELECT uf,  COUNT(*)::int AS n FROM pedidos GROUP BY uf  ORDER BY n DESC`),
    pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN adesivo_carro = 'quero' THEN qtd_carros ELSE 0 END), 0)::int AS carros,
        COALESCE(SUM(CASE WHEN adesivo_moto  = 'quero' THEN qtd_motos  ELSE 0 END), 0)::int AS motos
      FROM pedidos`),
  ]);

  return {
    total: total.rows[0].n,
    porKit: porKit.rows,
    porUf: porUf.rows,
    adesivos: adesivos.rows[0],
  };
}

export async function atualizarStatus(id, status) {
  await pool.query(`UPDATE pedidos SET status = $1 WHERE id = $2`, [status, id]);
}

/** Exporta todos os pedidos em CSV (separador ; para o Excel pt-BR). */
export async function exportarCsv() {
  const { rows, fields } = await pool.query(`SELECT * FROM pedidos ORDER BY id`);
  const cabecalho = fields.map((f) => f.name);

  const escapar = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };

  return [
    cabecalho.join(';'),
    ...rows.map((l) => cabecalho.map((c) => escapar(l[c])).join(';')),
  ].join('\n');
}

export async function fecharBanco() {
  await pool.end();
}
