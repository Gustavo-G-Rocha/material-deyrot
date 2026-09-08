/**
 * Preenche, nos pedidos antigos, de qual domínio veio cada um.
 *
 * O site responde por dois endereços (um por candidato) e a origem decide o
 * que a pessoa recebe. Só que o host passou a ser gravado agora: os pedidos
 * anteriores estão com `origem` nula, e o dado não existe em lugar nenhum do
 * sistema — nem no banco, nem no log da aplicação, que nunca registrou
 * requisição. Ele só pode vir de fora. Este script é o caminho de entrada.
 *
 *   npm run origem -- --resumo
 *       Quantos pedidos já têm origem, quantos não têm, e em que datas estão.
 *       Comece por aqui.
 *
 *   npm run origem -- --antes-de 2026-07-15 --origem material.pedrodeyrot.com
 *       Todo pedido criado ANTES dessa data recebe esse domínio. É o método
 *       exato quando um dos domínios entrou no ar depois do outro: antes dele
 *       existir, não havia de onde mais o pedido vir.
 *
 *   npm run origem -- --entre 2026-07-15 2026-08-01 --origem material.willrocha.com.br
 *       Mesma ideia, numa janela fechada (início inclusivo, fim exclusivo).
 *
 *   npm run origem -- --pendentes > pendentes.csv
 *       Lista quem ainda está sem origem, com nome e WhatsApp, em CSV. É a
 *       lista de quem precisa ser perguntado. Depois de preencher a coluna
 *       `origem`, o mesmo arquivo volta pelo --csv.
 *
 *   npm run origem -- --csv respostas.csv
 *       Lê um arquivo com uma linha por pedido. Aceita `id;origem` ou
 *       `whatsapp;origem` (o WhatsApp é comparado só pelos dígitos). Serve
 *       para o que você levantou por fora: gente respondendo, planilha antiga,
 *       o que for.
 *
 *   npm run origem -- --do-log railway.json
 *       Cruza com o log HTTP do Railway (exportado em JSON). Casa cada
 *       POST /api/pedidos do log com o pedido do banco pela hora e pelo IP.
 *       É o único método que recupera a origem real dos pedidos antigos, e só
 *       alcança o período que ainda estiver dentro da retenção de log do
 *       Railway.
 *
 * NADA é gravado sem `--aplicar`. Sem essa opção o script só mostra o que
 * faria. E ele nunca mexe em pedido que já tem origem, a não ser com
 * `--sobrescrever`.
 */

import { readFile } from 'node:fs/promises';

import { campanha } from '../config.js';
import { pool, temBanco, atualizarOrigemEmLote, fecharBanco } from '../lib/db.js';

const HOSTS = campanha.dominios.map((d) => d.host);

// --- leitura dos argumentos ----------------------------------------------

function lerArgumentos(argv) {
  const op = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { op._.push(a); continue; }
    const nome = a.slice(2);
    const proximo = argv[i + 1];
    if (proximo === undefined || proximo.startsWith('--')) op[nome] = true;
    else { op[nome] = proximo; i++; }
  }
  return op;
}

/** `--entre` leva dois valores; o segundo cai no resto e é resgatado aqui. */
function lerEntre(op) {
  const inicio = op.entre;
  const fim = op._[0];
  if (typeof inicio !== 'string' || !fim) {
    throw new Error('--entre precisa de duas datas: --entre 2026-07-15 2026-08-01');
  }
  return [dataDe(inicio), dataDe(fim)];
}

function dataDe(texto) {
  // Data sem hora vira meia-noite em São Paulo, não em UTC — senão o corte cai
  // três horas fora do lugar e leva pedidos do dia anterior junto.
  const cru = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00-03:00` : texto;
  const d = new Date(cru);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${texto}`);
  return d;
}

function exigirHost(op) {
  const host = String(op.origem || '').trim().toLowerCase();
  if (!HOSTS.includes(host)) {
    throw new Error(
      `--origem tem que ser um dos domínios do config.js:\n      ${HOSTS.join('\n      ')}`);
  }
  return host;
}

// --- consultas -----------------------------------------------------------

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/**
 * Chave de comparação de WhatsApp.
 *
 * O formulário grava o que a pessoa digitou, então o banco tem DDD + número
 * (41999998888). Quem monta a lista à mão costuma escrever com o código do
 * país (5541999998888) ou com o 9 a menos, nos números antigos. Comparar os
 * últimos 10 dígitos junta as três formas sem casar gente diferente: DDD e
 * número já cabem aí.
 */
const chaveWhats = (v) => soDigitos(v).slice(-10);

async function resumo() {
  const { rows } = await pool.query(`
    SELECT COALESCE(origem, 'sem origem') AS origem,
           COUNT(*)::int  AS n,
           MIN(criado_em) AS primeiro,
           MAX(criado_em) AS ultimo
      FROM pedidos GROUP BY 1 ORDER BY n DESC`);

  console.log('\n  Pedidos por domínio de origem:\n');
  for (const l of rows) {
    const de = l.primeiro.toISOString().slice(0, 10);
    const ate = l.ultimo.toISOString().slice(0, 10);
    console.log(`    ${String(l.n).padStart(5)}  ${l.origem.padEnd(28)} ${de} a ${ate}`);
  }

  const semOrigem = rows.find((l) => l.origem === 'sem origem');
  if (semOrigem) {
    console.log(`\n  ${semOrigem.n} pedido(s) sem origem. O host não foi gravado na`);
    console.log('  época, então esse dado só entra por fora — veja o cabeçalho');
    console.log('  deste arquivo para as opções.\n');
  } else {
    console.log('\n  Todos os pedidos têm origem registrada.\n');
  }
}

/**
 * Despeja em CSV quem ainda está sem origem.
 *
 * Sai com a coluna `origem` vazia de propósito: é o arquivo que vai a campo,
 * volta preenchido e entra de novo pelo --csv. Vai no stdout para poder
 * redirecionar, então nada mais é impresso aqui.
 */
async function pendentes() {
  const { rows } = await pool.query(`
    SELECT id, criado_em, nome, whatsapp, cidade, uf
      FROM pedidos WHERE origem IS NULL ORDER BY id`);

  const escapar = (v) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };

  console.log('id;origem;criado_em;nome;whatsapp;cidade;uf');
  for (const l of rows) {
    console.log([
      l.id, '', l.criado_em.toISOString().slice(0, 16).replace('T', ' '),
      l.nome, l.whatsapp, l.cidade, l.uf,
    ].map(escapar).join(';'));
  }
}

/** Os pedidos que o comando pode tocar, já respeitando --sobrescrever. */
async function pedidosAlvo(sobrescrever, filtroSql = '', valores = []) {
  const condicoes = [sobrescrever ? null : 'origem IS NULL', filtroSql || null]
    .filter(Boolean);
  const { rows } = await pool.query(`
    SELECT id, criado_em, ip, whatsapp_digitos, nome, origem
      FROM pedidos
     ${condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''}
     ORDER BY id`, valores);
  return rows;
}

// --- métodos de atribuição ------------------------------------------------

/** Corte por data: tudo antes (ou dentro da janela) recebe o mesmo domínio. */
async function porData(op) {
  const host = exigirHost(op);
  const sobrescrever = Boolean(op.sobrescrever);

  let filtro;
  let valores;
  let descricao;

  if (op['antes-de']) {
    const limite = dataDe(String(op['antes-de']));
    filtro = 'criado_em < $1';
    valores = [limite.toISOString()];
    descricao = `criados antes de ${limite.toISOString()}`;
  } else {
    const [inicio, fim] = lerEntre(op);
    filtro = 'criado_em >= $1 AND criado_em < $2';
    valores = [inicio.toISOString(), fim.toISOString()];
    descricao = `criados de ${inicio.toISOString()} até ${fim.toISOString()}`;
  }

  const alvos = await pedidosAlvo(sobrescrever, filtro, valores);
  console.log(`\n  ${alvos.length} pedido(s) ${descricao}`);
  console.log(`  receberiam a origem: ${host}\n`);
  if (alvos.length) {
    const ids = alvos.map((p) => p.id);
    console.log(`    ids: ${ids.slice(0, 20).join(', ')}${ids.length > 20 ? `, … (+${ids.length - 20})` : ''}`);
    console.log(`    do #${ids[0]} ao #${ids[ids.length - 1]}\n`);
  }
  return alvos.map((p) => ({ id: p.id, origem: host }));
}

/** Planilha/lista feita por fora: `id;origem` ou `whatsapp;origem`. */
async function porCsv(op) {
  const caminho = String(op.csv);
  const bruto = await readFile(caminho, 'utf8');
  const sobrescrever = Boolean(op.sobrescrever);

  const alvos = await pedidosAlvo(sobrescrever);
  const porId = new Map(alvos.map((p) => [p.id, p]));
  const porWhats = new Map(alvos.map((p) => [chaveWhats(p.whatsapp_digitos), p]));

  const pares = [];
  const problemas = [];

  bruto.split(/\r?\n/).forEach((linha, i) => {
    const texto = linha.trim();
    if (!texto || /^(id|whatsapp)\b/i.test(texto)) return;   // vazio ou cabeçalho

    const campos = texto.split(/[;,\t]/).map((c) => c.trim());
    if (campos.length < 2) { problemas.push(`linha ${i + 1}: só um campo`); return; }

    const [chave, hostBruto] = campos;
    const host = hostBruto.toLowerCase();
    if (!HOSTS.includes(host)) { problemas.push(`linha ${i + 1}: domínio "${hostBruto}"`); return; }

    const pedido = /^\d+$/.test(chave) && porId.has(Number(chave))
      ? porId.get(Number(chave))
      : porWhats.get(chaveWhats(chave));

    if (!pedido) { problemas.push(`linha ${i + 1}: "${chave}" não bate com pedido pendente`); return; }
    pares.push({ id: pedido.id, origem: host, linha: i + 1 });
  });

  /*
   * O mesmo pedido pode cair em duas linhas — uma pelo id, outra pelo telefone.
   * Se as duas dizem o mesmo domínio é só repetição, e vale uma. Se dizem
   * domínios diferentes, o arquivo se contradiz: as duas linhas são recusadas
   * e o pedido fica sem origem. A origem decide o que a pessoa recebe, então
   * desempatar no chute não é opção.
   */
  const porPedido = new Map();
  for (const par of pares) {
    const anterior = porPedido.get(par.id);
    if (!anterior) { porPedido.set(par.id, par); continue; }
    if (anterior.origem !== par.origem) {
      anterior.conflito = true;
      problemas.push(`linha ${par.linha}: pedido #${par.id} já aparece na linha `
        + `${anterior.linha} com outro domínio — as duas foram ignoradas`);
    }
  }

  const finais = [...porPedido.values()]
    .filter((p) => !p.conflito)
    .map(({ id, origem }) => ({ id, origem }));

  console.log(`\n  ${finais.length} pedido(s) casados a partir de ${caminho}`);
  if (problemas.length) {
    console.log(`  ${problemas.length} linha(s) ignorada(s):`);
    for (const p of problemas.slice(0, 15)) console.log(`    ${p}`);
    if (problemas.length > 15) console.log(`    … (+${problemas.length - 15})`);
  }
  console.log('');
  return finais;
}

/**
 * Log HTTP do Railway.
 *
 * Aceita JSON por linha ou um array JSON — é o que a interface do Railway
 * copia. Os nomes dos campos mudam conforme a origem do export, então a
 * varredura é tolerante: procura host, hora, caminho e IP em qualquer
 * profundidade do objeto.
 */
async function porLog(op) {
  const caminho = String(op['do-log']);
  const bruto = await readFile(caminho, 'utf8');
  const toleranciaS = Number(op.tolerancia) || 90;
  const sobrescrever = Boolean(op.sobrescrever);

  const eventos = extrairEventos(bruto);
  const posts = eventos.filter((e) => e.caminho.includes('/api/pedidos') && e.metodo === 'POST');
  console.log(`\n  ${eventos.length} evento(s) no log, ${posts.length} POST /api/pedidos`);

  if (!posts.length) {
    console.log('  Nada para cruzar. Confira se o export inclui o campo de host,');
    console.log('  o método e o caminho da requisição.\n');
    return [];
  }

  const alvos = await pedidosAlvo(sobrescrever);
  const pares = [];
  const ambiguos = [];
  const semPar = [];

  for (const pedido of alvos) {
    const t = new Date(pedido.criado_em).getTime();
    const perto = posts.filter((e) => Math.abs(e.hora - t) <= toleranciaS * 1000);

    // O IP desempata quando duas pessoas pedem no mesmo minuto.
    const mesmoIp = pedido.ip ? perto.filter((e) => e.ip && e.ip === pedido.ip) : [];
    const candidatos = mesmoIp.length ? mesmoIp : perto;

    const hosts = [...new Set(candidatos.map((e) => e.host))].filter((h) => HOSTS.includes(h));
    if (hosts.length === 1) pares.push({ id: pedido.id, origem: hosts[0] });
    else if (hosts.length > 1) ambiguos.push(pedido.id);
    else semPar.push(pedido.id);
  }

  console.log(`  ${pares.length} pedido(s) identificados com segurança`);
  if (ambiguos.length) {
    console.log(`  ${ambiguos.length} ambíguo(s) (dois domínios na mesma janela, sem IP que desempate): `
      + ambiguos.slice(0, 20).join(', '));
    console.log('    → reduza a janela com --tolerancia 20, ou resolva esses à mão');
  }
  if (semPar.length) {
    console.log(`  ${semPar.length} sem correspondência no log `
      + '(fora da retenção do Railway, provavelmente)');
  }
  console.log('');
  return pares;
}

/** Puxa host/hora/método/caminho/ip de qualquer formato de log JSON. */
function extrairEventos(bruto) {
  const objetos = [];

  const texto = bruto.trim();
  if (texto.startsWith('[')) {
    try { objetos.push(...JSON.parse(texto)); } catch { /* cai no modo linha */ }
  }
  if (!objetos.length) {
    for (const linha of texto.split(/\r?\n/)) {
      const t = linha.trim();
      if (!t.startsWith('{')) continue;
      try { objetos.push(JSON.parse(t)); } catch { /* linha quebrada, ignora */ }
    }
  }

  return objetos.map((o) => {
    const achar = (...nomes) => {
      const pilha = [o];
      while (pilha.length) {
        const atual = pilha.pop();
        if (!atual || typeof atual !== 'object') continue;
        for (const [chave, valor] of Object.entries(atual)) {
          if (valor && typeof valor === 'object') { pilha.push(valor); continue; }
          if (nomes.includes(chave.toLowerCase()) && valor !== '' && valor != null) return valor;
        }
      }
      return null;
    };

    const hora = achar('timestamp', 'time', 'ts', '@timestamp', 'requeststart');
    return {
      host: String(achar('host', 'httphost', 'authority', ':authority') || '').toLowerCase(),
      metodo: String(achar('method', 'httpmethod', 'requestmethod') || '').toUpperCase(),
      caminho: String(achar('path', 'url', 'requestpath', 'uri') || ''),
      ip: String(achar('srcip', 'clientip', 'remoteaddr', 'ip', 'x-forwarded-for') || '') || null,
      hora: new Date(hora || 0).getTime(),
    };
  }).filter((e) => Number.isFinite(e.hora) && e.hora > 0);
}

// --- execução -------------------------------------------------------------

async function principal() {
  const op = lerArgumentos(process.argv.slice(2));

  if (!temBanco) {
    console.error('\n  DATABASE_URL não está definida. Aponte para o Postgres do Railway:');
    console.error('    DATABASE_URL="postgresql://..." npm run origem -- --resumo\n');
    process.exit(1);
  }

  if (op.pendentes) return pendentes();
  if (op.resumo || Object.keys(op).length === 1) return resumo();

  let pares;
  if (op['antes-de'] || op.entre) pares = await porData(op);
  else if (op.csv) pares = await porCsv(op);
  else if (op['do-log']) pares = await porLog(op);
  else {
    console.error('\n  Escolha um método: --resumo, --pendentes, --antes-de, --entre,');
    console.error('  --csv ou --do-log.');
    console.error('  O cabeçalho de scripts/origem.js explica cada um.\n');
    process.exit(1);
  }

  if (!pares.length) {
    console.log('  Nenhum pedido para atualizar.\n');
    return;
  }

  if (!op.aplicar) {
    console.log('  SIMULAÇÃO — nada foi gravado.');
    console.log('  Repita o comando com --aplicar para valer.\n');
    return;
  }

  const mudadas = await atualizarOrigemEmLote(pares);
  console.log(`  ${mudadas} pedido(s) atualizados.\n`);
}

principal()
  .catch((err) => {
    console.error(`\n  ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(fecharBanco);
