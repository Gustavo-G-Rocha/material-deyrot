/**
 * Login do painel: dois acessos fixos, sessão em cookie assinado.
 *
 * Não há tabela de usuários nem sessão em memória de propósito — a lista de
 * quem entra está em `acessos` (config.js) e o cookie carrega a própria
 * validade assinada, então o painel sobrevive a restart e deploy sem
 * derrubar quem está logado.
 *
 * A senha nunca aparece em lugar nenhum: o que fica guardado é um hash
 * scrypt com sal. Para gerar o de uma senha nova: npm run senha "a senha".
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { acessos } from '../config.js';

const SEGREDO = process.env.SESSAO_SEGREDO || process.env.ADMIN_TOKEN || 'trocar-este-token';
const DURACAO_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'sessao';

// --- senha ---------------------------------------------------------------

export function gerarHash(senha) {
  const sal = randomBytes(16).toString('hex');
  return `scrypt$${sal}$${scryptSync(senha, sal, 32).toString('hex')}`;
}

function conferirHash(senha, hash) {
  const [algoritmo, sal, chave] = String(hash || '').split('$');
  if (algoritmo !== 'scrypt' || !sal || !chave) return false;

  const esperado = Buffer.from(chave, 'hex');
  const obtido = scryptSync(senha, sal, esperado.length);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

/** Hash descartável: faz o scrypt rodar mesmo com e-mail inexistente, para
 *  que o tempo de resposta não denuncie quais e-mails têm acesso. */
const HASH_FALSO = gerarHash(randomBytes(12).toString('hex'));

export function autenticar(email, senha) {
  const alvo = String(email || '').trim().toLowerCase();
  const usuario = acessos.find((u) => u.email.toLowerCase() === alvo);
  const senhaOk = conferirHash(String(senha || ''), usuario ? usuario.hash : HASH_FALSO);
  return usuario && senhaOk ? { email: usuario.email, nome: usuario.nome } : null;
}

// --- sessão --------------------------------------------------------------

function assinar(texto) {
  return createHmac('sha256', SEGREDO).update(texto).digest('base64url');
}

export function criarSessao(usuario) {
  const corpo = Buffer.from(JSON.stringify({
    email: usuario.email,
    exp: Date.now() + DURACAO_MS,
  })).toString('base64url');
  return `${corpo}.${assinar(corpo)}`;
}

/** Devolve o usuário do cookie, ou null se faltar, expirar ou não bater a assinatura. */
export function lerSessao(req) {
  const bruto = cookiesDe(req)[COOKIE];
  if (!bruto) return null;

  const [corpo, assinatura] = bruto.split('.');
  if (!corpo || !assinatura) return null;

  const esperada = Buffer.from(assinar(corpo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;

  try {
    const { email, exp } = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!exp || Date.now() > exp) return null;
    // Tirar alguém de `acessos` derruba a sessão dele no próximo clique.
    const usuario = acessos.find((u) => u.email === email);
    return usuario ? { email: usuario.email, nome: usuario.nome } : null;
  } catch {
    return null;
  }
}

// --- cookie --------------------------------------------------------------

function cookiesDe(req) {
  const saida = {};
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const igual = parte.indexOf('=');
    if (igual > 0) saida[parte.slice(0, igual).trim()] = parte.slice(igual + 1).trim();
  }
  return saida;
}

/** No Railway o TLS termina no proxy, então quem sabe do https é o header. */
function seguro(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

export function cookieSessao(valor, req) {
  const partes = [
    `${COOKIE}=${valor}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',           // Lax e não Strict: o download do CSV é navegação
    `Max-Age=${Math.floor(DURACAO_MS / 1000)}`,
  ];
  if (seguro(req)) partes.push('Secure');
  return partes.join('; ');
}

export function cookieSaida(req) {
  const partes = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (seguro(req)) partes.push('Secure');
  return partes.join('; ');
}
