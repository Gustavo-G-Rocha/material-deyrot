/**
 * Configuração central da campanha.
 *
 * TROQUE AQUI os candidatos, cores, links e kits.
 * Tudo que o frontend mostra vem deste arquivo (servido em GET /api/config),
 * então não é preciso mexer no HTML para trocar de candidato.
 */

export const campanha = {
  // ---- Candidatos --------------------------------------------------------
  candidatos: [
    {
      nome: 'Pedro Deyrot',
      cargo: 'Deputado Federal',
      numero: '1414',
      foto: '/assets/deyrot.jpeg',
    },
    {
      nome: 'Will Rocha',
      cargo: 'Deputado Estadual',
      numero: '14014',
      foto: '/assets/will.jpeg',
    },
  ],

  partido: 'MISSÃO',
  ano: 2026,
  uf: 'SP',

  /**
   * Identidade visual — tema escuro com uma cor de destaque.
   *
   * Na prática você só precisa mexer em `acento`: todo o resto do site
   * (botões, bordas, brilho do topo, selos, foco dos campos) é derivado
   * dele por color-mix no theme.css. Os fundos só mudam se você quiser
   * um preto mais quente ou mais frio.
   */
  tema: {
    acento: '#f5b301',        // amarelo da campanha
    acentoClaro: '#ffd24a',
    acentoEscuro: '#c98a00',
    acentoTinta: '#15100a',   // texto escrito por cima do amarelo: precisa ser escuro
    fundo: '#0c0b09',
    fundo2: '#141210',
    fundo3: '#1d1a15',
    tinta: '#f6f3ec',
    tintaFraca: '#b0a99b',
  },

  // ---- Links externos ----------------------------------------------------
  links: {
    whatsappGrupo: 'https://chat.whatsapp.com/LJxjfnqcAhsKcjcTc3ALz6?s=qt&p=a&mlu=4',
    site: 'https://pedrodeyrot.com/',
    privacidade: '/privacidade',
    compartilhar:
      'Pedi meu material de campanha pra ajudar na rua. Peça o seu também:',
  },

  /**
   * Painel lateral do menu. Mistura âncoras desta página com os outros
   * portais da campanha. `nota` é a linha cinza embaixo do nome;
   * `atual: true` destaca o item da página em que a pessoa já está.
   */
  menu: [
    { rotulo: 'Peça seu material', href: '#pedir', nota: 'Você está aqui', atual: true },
    { rotulo: 'Kits disponíveis', href: '#kits', nota: 'Os três tamanhos' },
    { rotulo: 'Adesivo de carro', href: '#adesivo', nota: 'Vidro traseiro perfurado' },
    { rotulo: 'Como funciona', href: '#como-funciona', nota: 'Do pedido à entrega' },
    // Outros portais da campanha, se houver:
    // { rotulo: 'Eventos', href: 'https://eventos.seusite.com.br', nota: 'eventos.seusite.com.br' },
    // { rotulo: 'Participe', href: 'https://participe.seusite.com.br', nota: 'participe.seusite.com.br' },
  ],

  /**
   * Contato do responsável pelos dados (encarregado / DPO).
   * A LGPD exige um canal que funcione de verdade para pedidos de acesso,
   * correção e exclusão — este endereço aparece na política de privacidade.
   * TROQUE pelo e-mail real antes de publicar.
   */
  suporte: {
    email: 'contato@pedrodeyrot.com',
    whatsapp: '+55 11 90000-0000',
  },

  /**
   * Identificação do controlador dos dados, exigida pela LGPD (art. 9º).
   * Preencha com os dados reais do comitê / candidato antes de publicar.
   */
  controlador: {
    nome: 'Comitê Financeiro de Campanha — Pedro Deyrot',
    cnpj: '00.000.000/0001-00',
    endereco: 'Endereço completo do comitê, cidade/UF, CEP',
  },
};

/**
 * Kits disponíveis, do menor para o maior.
 *
 * `pontos` é a nota mínima de engajamento para o kit ser recomendado
 * automaticamente (ver calcularEngajamento em lib/scoring.js) e `faixa` é
 * como essa regra aparece para a pessoa. O Kit P fica com pontos 0 porque é
 * o piso: qualquer nota abaixo de 7 cai nele.
 */
export const kits = [
  {
    slug: 'p',
    nome: 'Kit P',
    resumo: 'Para quem está começando a divulgar entre conhecidos.',
    pontos: 0,
    faixa: '4 a 6 pontos',
    itens: [
      { qtd: 10, item: 'santões', slug: 'santoes' },
      { qtd: 10, item: 'colinhas', slug: 'colinhas' },
      { qtd: 3, item: 'praguinhas de celular', slug: 'praguinhas' },
    ],
  },
  {
    slug: 'm',
    nome: 'Kit M',
    resumo: 'Dá para cobrir a sua rua e o comércio mais próximo.',
    pontos: 7,
    faixa: '7 a 9 pontos',
    itens: [
      { qtd: 30, item: 'santões', slug: 'santoes' },
      { qtd: 30, item: 'colinhas', slug: 'colinhas' },
      { qtd: 5, item: 'praguinhas de celular', slug: 'praguinhas' },
      { qtd: 3, item: 'pragões', slug: 'pragoes' },
      { qtd: 1, item: 'parachoque', slug: 'parachoques' },
    ],
  },
  {
    slug: 'g',
    nome: 'Kit G',
    resumo: 'Para quem já tem um grupo ajudando na distribuição.',
    pontos: 10,
    faixa: '10 a 12 pontos',
    itens: [
      { qtd: 50, item: 'santões', slug: 'santoes' },
      { qtd: 50, item: 'colinhas', slug: 'colinhas' },
      { qtd: 5, item: 'praguinhas de celular', slug: 'praguinhas' },
      { qtd: 4, item: 'pragões', slug: 'pragoes' },
      { qtd: 2, item: 'parachoques', slug: 'parachoques' },
    ],
  },
];

/**
 * Catálogo do que pode ser despachado, na ordem em que aparece no painel e
 * no CSV. Cada `slug` vira uma coluna `env_<slug>` na exportação, que é o
 * formato que o sistema de logística consome.
 *
 * Os `slug` daqui têm que bater com os `slug` dos itens dos kits acima —
 * é assim que o painel sabe a quantidade padrão de cada pedido. Item novo:
 * acrescente aqui e nos kits que o usam; nada muda no banco.
 */
export const itensEnvio = [
  { slug: 'santoes', rotulo: 'Santões' },
  { slug: 'colinhas', rotulo: 'Colinhas' },
  { slug: 'praguinhas', rotulo: 'Praguinhas de celular' },
  { slug: 'pragoes', rotulo: 'Pragões' },
  { slug: 'parachoques', rotulo: 'Parachoques' },
  { slug: 'adesivo_carro', rotulo: 'Adesivo de carro' },
  { slug: 'adesivo_moto', rotulo: 'Adesivo de moto' },
];

/** Opções dos campos de escolha — usadas no form e validadas no servidor. */
export const opcoes = {
  adesivoCarro: [
    { valor: 'quero', rotulo: 'Quero adesivar meu carro' },
    { valor: 'prefiro_outros', rotulo: 'Tenho carro, mas prefiro outros materiais' },
    { valor: 'so_kit', rotulo: 'Quero receber só o kit' },
    { valor: 'sem_carro', rotulo: 'Não tenho carro' },
  ],
  adesivoMoto: [
    { valor: 'quero', rotulo: 'Quero adesivar minha moto' },
    { valor: 'prefiro_outros', rotulo: 'Tenho moto, mas prefiro outros materiais' },
    { valor: 'so_kit', rotulo: 'Quero receber só o kit' },
    { valor: 'sem_moto', rotulo: 'Não tenho moto' },
  ],
  disponibilidade: [
    { valor: 'ate_1h', rotulo: 'Até 1 hora', pontos: 1 },
    { valor: '1_a_3h', rotulo: 'De 1 a 3 horas', pontos: 2 },
    { valor: 'mais_3h', rotulo: 'Mais de 3 horas', pontos: 3 },
  ],
  contatos: [
    { valor: 'ate_10', rotulo: 'Até 10 pessoas', pontos: 1 },
    { valor: '10_a_30', rotulo: 'De 10 a 30 pessoas', pontos: 2 },
    { valor: 'mais_30', rotulo: 'Mais de 30 pessoas', pontos: 3 },
  ],
  distribuidores: [
    { valor: 'so_eu', rotulo: 'Por enquanto, só eu mesmo', pontos: 1 },
    { valor: 'algumas', rotulo: 'Sim, algumas pessoas', pontos: 2 },
    { valor: 'varias', rotulo: 'Sim, várias pessoas', pontos: 3 },
  ],
  simNao: [
    { valor: 'nao', rotulo: 'Não' },
    { valor: 'sim', rotulo: 'Sim' },
  ],
};

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

/**
 * Quem entra no painel /admin. NÃO entra em `configPublica()`.
 *
 * A senha não fica aqui — só um hash scrypt com sal, que não dá para
 * desfazer. Para trocar a senha de alguém ou incluir mais uma pessoa:
 *
 *     npm run senha "a senha nova"
 *
 * e cole o `hash:` que ele imprime na linha da pessoa. Remover alguém desta
 * lista derruba a sessão dela no clique seguinte.
 */
export const acessos = [
  {
    nome: 'Pedro Deyrot',
    email: 'pedrodeyrot14@gmail.com',
    hash: 'scrypt$e6114ef43f55e1155847936c85dff3f1$5fba97807d857aaaae09ef55014a0daf499753923af766b25b5144de5f970f5f',
  },
  {
    nome: 'Campanha Will Rocha',
    email: 'campanhawillrocha@gmail.com',
    hash: 'scrypt$ea915de029debff12410f57b11af96cb$f9c9afc67d92a5105f94e28aec4084cd65394a26b6853c69021ca9cd812e80ee',
  },
];

/**
 * Integrações do servidor. NÃO entra em `configPublica()` — o navegador
 * não recebe nada daqui.
 *
 * `planilhaUrl` é o endereço /exec do Web App do Apps Script que espelha os
 * pedidos no Google Planilhas (veja planilha/LEIA-ME.md). Deixar em branco
 * ou remover a variável desliga o envio em tempo real; a sincronização
 * automática da planilha continua funcionando de qualquer jeito.
 */
export const integracoes = {
  planilhaUrl: process.env.PLANILHA_URL
    || 'https://script.google.com/macros/s/AKfycbzdP5KhAym6euXMt_ob90bADCdtyZHZoxqVPG6ScbF8UMctS-bdlTZ2TyCxio4-vt17/exec',
};

/** Config pública entregue ao navegador (nada sensível aqui). */
export function configPublica() {
  return { campanha, kits, opcoes, ufs: UFS };
}
