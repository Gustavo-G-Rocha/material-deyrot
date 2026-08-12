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
let kitEscolhido = null;
let kitSugerido = null;

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
  renderKitsEscolha();
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
  $('[data-ano]').textContent = c.ano;
  $('[data-partido]').textContent = c.partido;
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

  // aparece no rodapé e também no aceite da etapa 6
  $$('[data-link-privacidade]').forEach((a) => { a.href = c.links.privacidade; });
  $('[data-link-instagram]').href = c.links.instagram;
  $('[data-link-site]').href = c.links.site;
  $('[data-link-email]').href = `mailto:${c.suporte.email}`;
  $('[data-link-whatsapp]').href = c.links.whatsappGrupo;
  $('[data-etapa-total]').textContent = TOTAL;
}

function renderCandidatos() {
  $('[data-candidatos]').innerHTML = CFG.campanha.candidatos.map((c) => `
    <div class="cartao-candidato">
      <div class="foto" style="background-image:url('${esc(c.foto)}')">${esc(iniciais(c.nome))}</div>
      <div>
        <div class="nome">${esc(c.nome)}</div>
        <div class="cargo">${esc(c.cargo)}</div>
      </div>
      <div class="numero">${esc(c.numero)}</div>
    </div>
  `).join('');
}

const itensHtml = (kit) => kit.itens
  .map((i) => `<li><b>${i.qtd}</b> ${esc(i.item)}</li>`).join('');

function renderVitrineKits() {
  $('[data-kits-vitrine]').innerHTML = CFG.kits.map((k) => `
    <article class="kit">
      <h3>${esc(k.nome)}</h3>
      <p class="kit-resumo">${esc(k.resumo)}</p>
      <ul>${itensHtml(k)}</ul>
    </article>
  `).join('');
}

function renderKitsEscolha() {
  $('[data-kits-escolha]').innerHTML = CFG.kits.map((k) => `
    <article class="kit" data-kit="${esc(k.slug)}" role="button" tabindex="0"
             aria-pressed="false" aria-label="Escolher ${esc(k.nome)}">
      <span class="kit-etiqueta" data-etiqueta hidden>Recomendado</span>
      <h3>${esc(k.nome)}</h3>
      <p class="kit-resumo">${esc(k.resumo)}</p>
      <ul>${itensHtml(k)}</ul>
    </article>
  `).join('');

  $$('[data-kit]').forEach((card) => {
    const escolher = () => selecionarKit(card.dataset.kit);
    card.addEventListener('click', escolher);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); }
    });
  });
}

function selecionarKit(slug) {
  kitEscolhido = slug;
  $$('[data-kit]').forEach((c) => {
    const ativo = c.dataset.kit === slug;
    c.classList.toggle('selecionado', ativo);
    c.setAttribute('aria-pressed', String(ativo));
  });
  limparErro('kit');
}

function renderUFs() {
  const sel = $('#uf');
  sel.insertAdjacentHTML('beforeend',
    CFG.ufs.map((uf) => `<option value="${uf}">${uf}</option>`).join(''));
}

const MAPA_OPCOES = {
  adesivo_carro: 'adesivoCarro',
  adesivo_moto: 'adesivoMoto',
  disponibilidade: 'disponibilidade',
  contatos: 'contatos',
  distribuidores: 'distribuidores',
  mora_condominio: 'simNao',
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

  if (etapaAtual === 5) sugerirKit();
  if (etapaAtual === TOTAL) montarRevisao();

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
  ],
  2: [
    ['cep', (v) => v.replace(/\D/g, '').length === 8, 'CEP deve ter 8 dígitos.'],
    ['uf', (v) => !!v, 'Selecione o estado.'],
    ['cidade', (v) => v.trim().length >= 2, 'Informe a cidade.'],
    ['endereco', (v) => v.trim().length >= 3, 'Informe o endereço.'],
    ['numero', (v) => v.trim().length >= 1, 'Informe o número (ou S/N).'],
  ],
  3: [
    ['adesivo_carro', null, 'Escolha uma opção.'],
    ['adesivo_moto', null, 'Escolha uma opção.'],
  ],
  4: [
    ['disponibilidade', null, 'Escolha uma opção.'],
    ['contatos', null, 'Escolha uma opção.'],
    ['distribuidores', null, 'Escolha uma opção.'],
    ['mora_condominio', null, 'Escolha uma opção.'],
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

  if (n === 5 && !kitEscolhido) {
    mostrarErro('kit', 'Escolha um dos kits para continuar.');
    ok = false;
    primeiroErro ??= 'kit';
  }

  if (n === 6 && !$('#aceite_lgpd').checked) {
    mostrarErro('aceite_lgpd', 'É preciso autorizar o uso dos dados para o envio.');
    ok = false;
    primeiroErro ??= 'aceite_lgpd';
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

// ---------- recomendação de kit ------------------------------------------

async function sugerirKit() {
  const caixa = $('[data-recomendacao]');
  try {
    const r = await fetch('/api/recomendar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(coletar()),
    });
    const { kit } = await r.json();
    kitSugerido = kit.slug;

    $$('[data-kit]').forEach((c) => {
      $('[data-etiqueta]', c).hidden = c.dataset.kit !== kit.slug;
    });

    caixa.hidden = false;
    caixa.innerHTML = `Pelas suas respostas, o <b>${esc(kit.nome)}</b> é o que faz mais
      sentido agora — mas a escolha é sua, é só clicar em outro.`;

    if (!kitEscolhido) selecionarKit(kit.slug);
  } catch {
    caixa.hidden = true;
  }
}

// ---------- revisão -------------------------------------------------------

function rotuloDe(campo, valor) {
  const lista = CFG.opcoes[MAPA_OPCOES[campo]] || [];
  return lista.find((o) => o.valor === valor)?.rotulo || '—';
}

function montarRevisao() {
  const d = coletar();
  const kit = CFG.kits.find((k) => k.slug === kitEscolhido);

  const linhas = [
    ['Contato', 1, `${d.nome}<br>${d.email}<br>${d.whatsapp}`],
    ['Entrega', 2, `${d.endereco}, ${d.numero}${d.complemento ? ` — ${d.complemento}` : ''}<br>
                    ${d.bairro ? d.bairro + '<br>' : ''}${d.cidade} / ${d.uf} — CEP ${d.cep}`],
    ['Adesivo de carro', 3, rotuloDe('adesivo_carro', d.adesivo_carro)
      + (d.adesivo_carro === 'quero' ? ` (${d.qtd_carros})` : '')],
    ['Adesivo de moto', 3, rotuloDe('adesivo_moto', d.adesivo_moto)
      + (d.adesivo_moto === 'quero' ? ` (${d.qtd_motos})` : '')],
    ['Kit escolhido', 5, kit ? `${esc(kit.nome)} — ${kit.itens.map((i) => `${i.qtd} ${i.item}`).join(', ')}` : '—'],
  ];

  $('[data-revisao]').innerHTML = linhas.map(([titulo, etapa, conteudo]) => `
    <dl class="revisao-item">
      <div>
        <dt>${titulo}</dt>
        <dd>${conteudo}</dd>
      </div>
      <button type="button" data-corrigir="${etapa}">Corrigir</button>
    </dl>
  `).join('');

  $$('[data-corrigir]').forEach((b) =>
    b.addEventListener('click', () => mostrarEtapa(Number(b.dataset.corrigir))));
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
  if (!validarEtapa(6)) return;

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
        if (etapaDoErro !== 6) mostrarEtapa(etapaDoErro);
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
  return campo === 'kit' ? 5 : 6;
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
