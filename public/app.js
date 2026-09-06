/* ============================================================
   Formulário multi-etapas + renderização orientada por config
   ============================================================ */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

const form = $('#form-pedido');
const etapas = $$('.etapa', form);
const TOTAL = etapas.length;

let etapaAtual = 1;
let CFG = null;
// O formulário não pergunta mais o perfil de quem pede: todo pedido sai
// como Kit M, sem escolha do usuário (ver validarPedido em lib/validacao.js).
const kitEscolhido = 'm';

// ---------- boot ----------------------------------------------------------

init();

async function init() {
  CFG = await fetch('/api/config').then((r) => r.json());
  aplicarTema(CFG.campanha.tema);
  renderCabecalho();
  renderCandidatos();
  renderVitrineKits();
  renderUFs();
  renderTodasOpcoes();
  ligarEventos();
  mostrarEtapa(1);
}

/** config.js usa camelCase; o CSS usa kebab-case. */
const TOKENS = {
  acento: '--acento',
  acentoClaro: '--acento-claro',
  acentoEscuro: '--acento-escuro',
  acentoTinta: '--acento-tinta',
  fundo: '--fundo',
  fundo2: '--fundo-2',
  fundo3: '--fundo-3',
  tinta: '--tinta',
  tintaFraca: '--tinta-fraca',
};

function aplicarTema(tema = {}) {
  const raiz = document.documentElement;
  for (const [chave, variavel] of Object.entries(TOKENS)) {
    if (tema[chave]) raiz.style.setProperty(variavel, tema[chave]);
  }
}

// ---------- renderização a partir da config -------------------------------

function renderCabecalho() {
  const c = CFG.campanha;
  const nomes = c.candidatos.map((x) => x.nome).join(' · ');
  $('[data-campanha-titulo]').textContent = nomes;
  const ano = $('[data-ano]');
  if (ano) ano.textContent = c.ano;
  const partido = $('[data-partido]');
  if (partido) partido.textContent = c.partido;
  document.title = `Peça seu material · ${nomes}`;

  $('[data-rodape-campanha]').textContent =
    `${nomes} — ${c.partido} · Campanha ${c.ano}`;
  $('[data-portais-lista]').innerHTML = (c.menu || []).map((m) => {
    const externo = /^https?:/i.test(m.href);
    return `<li>
      <a class="portais-link${m.atual ? ' atual' : ''}" href="${esc(m.href)}"
         ${externo ? 'target="_blank" rel="noopener"' : ''}>
        <span class="portais-link-nome">${esc(m.rotulo)}</span>
        ${m.nota ? `<span class="portais-link-url">${esc(m.nota)}</span>` : ''}
      </a>
    </li>`;
  }).join('');

  // aparece no rodapé e também no aceite da última etapa
  $$('[data-link-privacidade]').forEach((a) => { a.href = c.links.privacidade; });
  $('[data-link-site]').href = c.links.site;
  $('[data-link-whatsapp]').href = c.links.whatsappGrupo;
  $('[data-etapa-total]').textContent = TOTAL;
}

function renderCandidatos() {
  const alvo = $('[data-candidatos]');
  if (!alvo) return;
  alvo.innerHTML = CFG.campanha.candidatos.map((c) => `
    <div class="cartao-candidato">
      <div class="foto" style="background-image:url('${esc(c.foto)}')"
           >${c.foto ? '' : esc(iniciais(c.nome))}</div>
      <div>
        <div class="nome">${esc(c.nome)}</div>
        <div class="cargo">${esc(c.cargo)}</div>
      </div>
      <div class="numero">${esc(c.numero)}</div>
    </div>
  `).join('');
}

/*
 * A vitrine lista o que vem no kit, sem número. A quantidade fecha na
 * produção, conforme o estoque do dia — se aparecesse aqui, todo ajuste de
 * separação viraria uma alteração no site.
 */
const itensHtml = (kit) => kit.itens
  .map((i) => `<li>${esc(i.item)}</li>`).join('');

const faixaHtml = (kit) => kit.faixa
  ? `<span class="kit-faixa">${esc(kit.faixa)}</span>` : '';

function renderVitrineKits() {
  $('[data-kits-vitrine]').innerHTML = CFG.kits.map((k) => `
    <article class="kit">
      ${faixaHtml(k)}
      <h3>${esc(k.nome)}</h3>
      <p class="kit-resumo">${esc(k.resumo)}</p>
      <ul>${itensHtml(k)}</ul>
    </article>
  `).join('');
}

function renderUFs() {
  const sel = $('#uf');
  sel.insertAdjacentHTML('beforeend',
    CFG.ufs.map((uf) => `<option value="${uf}">${uf}</option>`).join(''));
}

const MAPA_OPCOES = {
  alcance: 'alcance',
};

function renderTodasOpcoes() {
  $$('[data-opcoes]').forEach((caixa) => {
    const campo = caixa.dataset.opcoes;
    const lista = CFG.opcoes[MAPA_OPCOES[campo]] || [];
    caixa.innerHTML = lista.map((o) => `
      <label class="opcao">
        <input type="radio" name="${campo}" value="${esc(o.valor)}">
        <span>${esc(o.rotulo)}</span>
      </label>
    `).join('');
  });

  // campos condicionais (ex.: quantos carros)
  form.addEventListener('change', (e) => {
    if (e.target.type === 'radio') {
      limparErro(e.target.name);
      atualizarCondicionais();
    }
  });
  atualizarCondicionais();
}

function atualizarCondicionais() {
  $$('[data-quando]').forEach((el) => {
    const [campo, valor] = el.dataset.quando.split('=');
    const marcado = form.querySelector(`[name="${campo}"]:checked`);
    el.hidden = !(marcado && marcado.value === valor);
  });
}

// ---------- navegação entre etapas ---------------------------------------

function mostrarEtapa(n, foco = true) {
  etapaAtual = Math.min(Math.max(n, 1), TOTAL);
  etapas.forEach((f) => { f.hidden = Number(f.dataset.etapa) !== etapaAtual; });

  $('[data-voltar]').hidden = etapaAtual === 1;
  $('[data-continuar]').hidden = etapaAtual === TOTAL;
  $('[data-enviar]').hidden = etapaAtual !== TOTAL;

  $('[data-etapa-atual]').textContent = etapaAtual;
  $('[data-progresso-barra]').style.width = `${(etapaAtual / TOTAL) * 100}%`;

  if (foco) {
    $('#pedir').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const primeiro = etapas[etapaAtual - 1].querySelector('input, select');
    if (primeiro && primeiro.type !== 'radio') setTimeout(() => primeiro.focus(), 350);
  }
}

function ligarEventos() {
  $('[data-continuar]').addEventListener('click', () => {
    if (validarEtapa(etapaAtual)) mostrarEtapa(etapaAtual + 1);
  });
  $('[data-voltar]').addEventListener('click', () => mostrarEtapa(etapaAtual - 1));

  form.addEventListener('submit', enviar);
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && etapaAtual < TOTAL) {
      e.preventDefault();
      $('[data-continuar]').click();
    }
  });

  form.addEventListener('input', (e) => limparErro(e.target.name));

  // máscaras
  mascara('#whatsapp', mascaraTelefone);
  mascara('#cep', mascaraCep);
  $('#cep').addEventListener('blur', buscarCep);

  $('[data-compartilhar]').addEventListener('click', compartilhar);

  ligarTopo();
  ligarPortais();
}

/** O cabeçalho encolhe e ganha fundo depois dos primeiros pixels de rolagem. */
function ligarTopo() {
  const topo = $('[data-topo]');
  let ticking = false;

  const atualizar = () => {
    topo.classList.toggle('encolhido', window.scrollY > 30);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(atualizar); }
  }, { passive: true });

  atualizar();
}

/** Painel lateral: hambúrguer, véu, ESC e clique num link fecham. */
function ligarPortais() {
  const painel = $('[data-portais]');
  const veu = $('[data-portais-veu]');
  const botao = $('[data-menu-btn]');

  const abrir = () => {
    veu.hidden = false;
    requestAnimationFrame(() => veu.classList.add('visivel'));
    painel.classList.add('aberto');
    painel.setAttribute('aria-hidden', 'false');
    botao.classList.add('aberto');
    botao.setAttribute('aria-expanded', 'true');
    document.body.classList.add('portais-abertos');
  };

  const fechar = () => {
    veu.classList.remove('visivel');
    setTimeout(() => { veu.hidden = true; }, 250);
    painel.classList.remove('aberto');
    painel.setAttribute('aria-hidden', 'true');
    botao.classList.remove('aberto');
    botao.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('portais-abertos');
  };

  botao.addEventListener('click', () =>
    painel.classList.contains('aberto') ? fechar() : abrir());
  veu.addEventListener('click', fechar);
  $('[data-portais-fechar]').addEventListener('click', fechar);
  painel.addEventListener('click', (e) => { if (e.target.closest('a')) fechar(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && painel.classList.contains('aberto')) fechar();
  });
}

function mascara(sel, fn) {
  const el = $(sel);
  el.addEventListener('input', () => {
    const pos = el.selectionStart === el.value.length;
    el.value = fn(el.value);
    if (pos) el.setSelectionRange(el.value.length, el.value.length);
  });
}

const mascaraTelefone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.replace(/(\d{0,2})/, '($1');
  if (d.length <= 6) return d.replace(/(\d{2})(\d+)/, '($1) $2');
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
};

const mascaraCep = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

async function buscarCep() {
  const cep = $('#cep').value.replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const r = await fetch(`/api/cep/${cep}`);
    if (!r.ok) return;
    const d = await r.json();
    if (d.uf) $('#uf').value = d.uf;
    if (d.cidade) $('#cidade').value = d.cidade;
    if (d.bairro) $('#bairro').value = d.bairro;
    if (d.endereco) $('#endereco').value = d.endereco;
    if (d.endereco) $('#numero').focus();
    ['uf', 'cidade', 'endereco'].forEach(limparErro);
  } catch { /* sem conexão: usuário digita à mão */ }
}

// ---------- validação no cliente -----------------------------------------

const REGRAS = {
  1: [
    ['nome', (v) => v.trim().includes(' ') && v.trim().length >= 3, 'Informe nome e sobrenome.'],
    ['email', (v) => /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(v.trim()), 'E-mail inválido.'],
    ['whatsapp', (v) => v.replace(/\D/g, '').length >= 10, 'Informe DDD + número.'],
    ['aceite_lgpd', () => $('#aceite_lgpd').checked, 'É preciso autorizar o uso dos dados para o envio.'],
  ],
  2: [
    ['cep', (v) => v.replace(/\D/g, '').length === 8, 'CEP deve ter 8 dígitos.'],
    ['uf', (v) => !!v, 'Selecione o estado.'],
    ['cidade', (v) => v.trim().length >= 2, 'Informe a cidade.'],
    ['endereco', (v) => v.trim().length >= 3, 'Informe o endereço.'],
    ['numero', (v) => v.trim().length >= 1, 'Informe o número (ou S/N).'],
  ],
  3: [
    ['alcance', null, 'Escolha uma opção.'],
  ],
};

function validarEtapa(n) {
  let ok = true;
  let primeiroErro = null;

  for (const [campo, teste, msg] of REGRAS[n] || []) {
    const valor = valorDe(campo);
    const valido = teste ? teste(valor ?? '') : !!valor;
    if (!valido) {
      mostrarErro(campo, msg);
      ok = false;
      primeiroErro ??= campo;
    }
  }

  if (primeiroErro) {
    const el = form.querySelector(`[name="${primeiroErro}"]`);
    el?.focus({ preventScroll: true });
    $(`[data-erro="${primeiroErro}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function valorDe(campo) {
  const radios = form.querySelectorAll(`[name="${campo}"][type="radio"]`);
  if (radios.length) return form.querySelector(`[name="${campo}"]:checked`)?.value || '';
  return form.querySelector(`[name="${campo}"]`)?.value ?? '';
}

function mostrarErro(campo, msg) {
  const alvo = $(`[data-erro="${campo}"]`);
  if (alvo) alvo.textContent = msg;
  form.querySelector(`[name="${campo}"]`)?.closest('.campo')?.classList.add('invalido');
}

function limparErro(campo) {
  if (!campo) return;
  const alvo = $(`[data-erro="${campo}"]`);
  if (alvo) alvo.textContent = '';
  form.querySelector(`[name="${campo}"]`)?.closest('.campo')?.classList.remove('invalido');
  $('[data-erro-geral]').textContent = '';
}

// ---------- envio ---------------------------------------------------------

function coletar() {
  const dados = Object.fromEntries(new FormData(form).entries());
  dados.kit = kitEscolhido;
  dados.aceite_lgpd = $('#aceite_lgpd').checked;
  return dados;
}

async function enviar(e) {
  e.preventDefault();
  if (!validarEtapa(TOTAL)) return;

  const botao = $('[data-enviar]');
  botao.disabled = true;
  botao.textContent = 'Enviando...';

  try {
    const r = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(coletar()),
    });
    const res = await r.json();

    if (!r.ok) {
      if (res.campos) {
        for (const [campo, msg] of Object.entries(res.campos)) mostrarErro(campo, msg);
        const etapaDoErro = etapaDoCampo(Object.keys(res.campos)[0]);
        if (etapaDoErro !== TOTAL) mostrarEtapa(etapaDoErro);
      }
      $('[data-erro-geral]').textContent = res.erro || 'Não foi possível enviar. Tente de novo.';
      return;
    }

    mostrarSucesso(res);
  } catch {
    $('[data-erro-geral]').textContent = 'Falha de conexão. Verifique a internet e tente de novo.';
  } finally {
    botao.disabled = false;
    botao.textContent = 'Pedir meu material';
  }
}

function etapaDoCampo(campo) {
  for (const [n, regras] of Object.entries(REGRAS)) {
    if (regras.some(([c]) => c === campo)) return Number(n);
  }
  return TOTAL;
}

function mostrarSucesso(res) {
  form.hidden = true;
  $('.progresso').hidden = true;
  const painel = $('[data-sucesso]');
  painel.hidden = false;
  $('[data-sucesso-msg]').innerHTML =
    `Seu <b>${esc(res.kit.nome)}</b> entrou na fila de separação. Avisamos pelo WhatsApp
     assim que o material sair para entrega. Protocolo <b>#${res.id}</b>.`;
  painel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function compartilhar() {
  const texto = `${CFG.campanha.links.compartilhar} ${location.origin}`;
  if (navigator.share) {
    try { await navigator.share({ text: texto, url: location.origin }); return; } catch { /* cancelado */ }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}

// ---------- util ----------------------------------------------------------

function iniciais(nome) {
  return String(nome || '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
