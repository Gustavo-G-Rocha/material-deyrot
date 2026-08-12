import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

import { configPublica } from './config.js';
import { validarPedido } from './lib/validacao.js';
import { calcularEngajamento, kitRecomendado, kitPorSlug } from './lib/scoring.js';
import {
  temBanco, descreverConexao, esperarBanco, migrar, criarPedido, listarPedidos,
  contarPedidos, atualizarStatus, exportarCsv, fecharBanco,
} from './lib/db.js';

const PORTA = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'trocar-este-token';
const PUBLIC_DIR = resolve(process.cwd(), 'public');

/**
 * Modo vitrine: sobe o site sem Postgres, só para ver o layout.
 * O formulário navega normalmente, mas o envio final é recusado.
 */
const SEM_BANCO = process.env.SEM_BANCO === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// --- utilidades ----------------------------------------------------------

function json(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  });
  res.end(buf);
}

async function lerJson(req, limiteBytes = 64 * 1024) {
  return new Promise((resolveP, rejectP) => {
    let tamanho = 0;
    const partes = [];
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > limiteBytes) {
        rejectP(new Error('Corpo muito grande'));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => {
      try {
        resolveP(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'));
      } catch {
        rejectP(new Error('JSON inválido'));
      }
    });
    req.on('error', rejectP);
  });
}

function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || null;
}

// Limite simples de requisições por IP (janela deslizante em memória).
const janela = new Map();
function excedeuLimite(ip, max = 12, ms = 10 * 60 * 1000) {
  const agora = Date.now();
  const marcas = (janela.get(ip) || []).filter((t) => agora - t < ms);
  marcas.push(agora);
  janela.set(ip, marcas);
  if (janela.size > 5000) janela.clear();
  return marcas.length > max;
}

function autorizado(url, req) {
  const token = url.searchParams.get('token')
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return token && token === ADMIN_TOKEN;
}

// --- rotas ---------------------------------------------------------------

async function servirEstatico(req, res, caminho) {
  const rel = normalize(caminho).replace(/^(\.\.[/\\])+/, '');
  let arquivo = join(PUBLIC_DIR, rel);
  if (!arquivo.startsWith(PUBLIC_DIR)) return json(res, 403, { erro: 'Proibido' });
  if (rel === '/' || rel === '\\' || rel === '') arquivo = join(PUBLIC_DIR, 'index.html');

  try {
    const conteudo = await readFile(arquivo);
    const tipo = MIME[extname(arquivo).toLowerCase()] || 'application/octet-stream';
    const cache = extname(arquivo) === '.html' ? 'no-cache' : 'public, max-age=3600';
    res.writeHead(200, { 'content-type': tipo, 'cache-control': cache });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada');
  }
}

async function consultarCep(cep) {
  const limpo = String(cep).replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  const ctrl = AbortSignal.timeout(5000);
  const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`, { signal: ctrl });
  if (!r.ok) return null;
  const d = await r.json();
  if (d.erro) return null;
  return {
    cep: limpo,
    uf: d.uf || '',
    cidade: d.localidade || '',
    bairro: d.bairro || '',
    endereco: d.logradouro || '',
  };
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rota = url.pathname;

  try {
    // ---- API pública ---------------------------------------------------
    if (rota === '/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, ts: new Date().toISOString() });
    }

    if (rota === '/api/config' && req.method === 'GET') {
      return json(res, 200, configPublica());
    }

    if (rota.startsWith('/api/cep/') && req.method === 'GET') {
      const dados = await consultarCep(rota.slice('/api/cep/'.length));
      return dados
        ? json(res, 200, dados)
        : json(res, 404, { erro: 'CEP não encontrado' });
    }

    if (rota === '/api/recomendar' && req.method === 'POST') {
      const body = await lerJson(req);
      const nota = calcularEngajamento(body);
      const kit = kitRecomendado(nota);
      return json(res, 200, { engajamento: nota, kit });
    }

    if (rota === '/api/pedidos' && req.method === 'POST') {
      if (SEM_BANCO) {
        return json(res, 503, {
          erro: 'Modo vitrine: sem banco conectado, o pedido não foi salvo. '
              + 'Rode com DATABASE_URL para gravar de verdade.',
        });
      }

      const ip = ipDe(req);
      if (excedeuLimite(ip)) {
        return json(res, 429, { erro: 'Muitas tentativas. Tente novamente mais tarde.' });
      }

      const body = await lerJson(req);

      // honeypot: campo invisível preenchido = bot
      if (String(body.website || '').trim() !== '') {
        return json(res, 200, { ok: true, id: 0 });
      }

      const v = validarPedido(body);
      if (!v.ok) return json(res, 400, { erro: 'Dados inválidos', campos: v.erros });

      const dados = v.dados;
      dados.engajamento = calcularEngajamento(dados);
      dados.kit_recomendado = kitRecomendado(dados.engajamento).slug;
      dados.ip = ip;
      dados.user_agent = (req.headers['user-agent'] || '').slice(0, 300);

      try {
        const { id } = await criarPedido(dados);
        return json(res, 201, {
          ok: true,
          id,
          kit: kitPorSlug(dados.kit),
          engajamento: dados.engajamento,
        });
      } catch (err) {
        if (err.codigo === 'DUPLICADO') {
          return json(res, 409, {
            erro: 'Já registramos um pedido para este WhatsApp.',
            campos: { whatsapp: 'Este número já pediu material.' },
          });
        }
        throw err;
      }
    }

    // ---- API administrativa --------------------------------------------
    if (rota.startsWith('/api/admin/')) {
      if (!autorizado(url, req)) return json(res, 401, { erro: 'Token inválido' });
      if (SEM_BANCO) return json(res, 503, { erro: 'Modo vitrine: sem banco conectado.' });

      if (rota === '/api/admin/pedidos' && req.method === 'GET') {
        const [resumo, pedidos] = await Promise.all([
          contarPedidos(),
          listarPedidos({
            limite: Math.min(Number(url.searchParams.get('limite')) || 200, 1000),
            offset: Number(url.searchParams.get('offset')) || 0,
            status: url.searchParams.get('status'),
          }),
        ]);
        return json(res, 200, { resumo, pedidos });
      }

      if (rota === '/api/admin/status' && req.method === 'POST') {
        const { id, status } = await lerJson(req);
        const validos = ['novo', 'separado', 'enviado', 'entregue', 'cancelado'];
        if (!validos.includes(status)) return json(res, 400, { erro: 'Status inválido' });
        await atualizarStatus(Number(id), status);
        return json(res, 200, { ok: true });
      }

      if (rota === '/api/admin/export.csv' && req.method === 'GET') {
        const csv = await exportarCsv();
        // BOM para o Excel reconhecer UTF-8
        const buf = Buffer.concat([Buffer.from('﻿'), Buffer.from(csv)]);
        res.writeHead(200, {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="pedidos.csv"',
          'content-length': buf.length,
        });
        return res.end(buf);
      }

      return json(res, 404, { erro: 'Rota não encontrada' });
    }

    // ---- estáticos ------------------------------------------------------
    if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido' });
    if (rota === '/admin') return servirEstatico(req, res, '/admin.html');
    if (rota === '/privacidade') return servirEstatico(req, res, '/privacidade.html');
    return servirEstatico(req, res, rota === '/' ? '/index.html' : rota);
  } catch (err) {
    console.error('[erro]', err);
    return json(res, 500, { erro: 'Erro interno' });
  }
});

// --- boot ----------------------------------------------------------------

/** O pg embrulha falhas de socket em AggregateError com message vazia. */
function descreverErroBanco(err) {
  const causas = err.errors?.length ? err.errors : [err];
  const partes = causas.map((e) => e.code || e.message).filter(Boolean);
  const texto = [...new Set(partes)].join(', ') || 'desconhecido';

  const dicas = {
    ECONNREFUSED: 'conexão recusada — host/porta errados ou banco fora do ar',
    ENOTFOUND: 'host não encontrado — confira o endereço na DATABASE_URL',
    ETIMEDOUT: 'tempo esgotado — provavelmente firewall ou host inacessível',
    '28P01': 'senha incorreta',
    '3D000': 'o banco informado não existe',
  };
  const dica = causas.map((e) => dicas[e.code]).find(Boolean);
  return dica ? `${texto} (${dica})` : texto;
}

async function iniciar() {
  if (SEM_BANCO) {
    console.log('\n  MODO VITRINE — sem Postgres. Pedidos não serão salvos.');
    servidor.listen(PORTA, '0.0.0.0', () =>
      console.log(`  Site: http://localhost:${PORTA}\n`));
    return;
  }

  if (!temBanco) {
    console.error('\n  ERRO: a variável DATABASE_URL não está definida neste serviço.');
    console.error('');
    console.error('  No Railway, criar o Postgres NÃO injeta a variável no app —');
    console.error('  são serviços separados. No serviço do site, adicione:');
    console.error('');
    console.error('      DATABASE_URL = ${{Postgres.DATABASE_URL}}');
    console.error('');
    console.error('  (troque "Postgres" pelo nome exato do serviço do banco)');
    console.error('  Para só ver o layout, sem banco: npm run preview\n');
    process.exit(1);
  }

  console.log(`\n  Conectando em ${descreverConexao()}`);

  try {
    await esperarBanco();
    await migrar();
  } catch (err) {
    console.error('\n  Não consegui conectar no Postgres.');
    console.error('  Motivo:', descreverErroBanco(err));
    console.error('  Alvo:  ', descreverConexao());
    console.error('');
    console.error('  Se o host termina em .railway.internal, confirme que o app e o');
    console.error('  banco estão no mesmo projeto e ambiente do Railway.\n');
    process.exit(1);
  }

  // 0.0.0.0 é obrigatório no Railway — em localhost o healthcheck não enxerga.
  servidor.listen(PORTA, '0.0.0.0', () => {
    console.log(`\n  Site:  http://localhost:${PORTA}`);
    console.log(`  Admin: http://localhost:${PORTA}/admin?token=${ADMIN_TOKEN}\n`);
  });
}

for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => {
    console.log(`\n  ${sinal} recebido, encerrando...`);
    servidor.close(async () => {
      await fecharBanco();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  });
}

iniciar();
