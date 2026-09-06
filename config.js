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
    whatsappGrupo: 'https://chat.whatsapp.com/JWPeRC3S8eQAJav3MBhdgX?s=cl&p=a&mlu=0',
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
    { rotulo: 'Adesivo perfurado', href: '#adesivo', nota: 'Só o vidro traseiro' },
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
 * Kits disponíveis. O formulário não pergunta mais o perfil de quem pede —
 * todo pedido sai como Kit M (ver validarPedido em lib/validacao.js). P e G
 * ficam no catálogo só para a vitrine pública (seção "Um kit para cada
 * ritmo") e para ajuste manual no painel, se um dia for preciso.
 *
 * O `qtd` de cada item NÃO aparece no site — a vitrine lista só o que vem no
 * kit, sem número. Ele serve para o padrão de separação (lib/envio.js) e para
 * as colunas env_* do CSV, então a produção pode fechar o G com 40 em vez de
 * 50 direto no painel, sem ninguém precisar mexer aqui.
 */
export const kits = [
  {
    slug: 'p',
    nome: 'Kit P',
    resumo: 'Para quem está começando a divulgar entre conhecidos.',
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
    itens: [
      { qtd: 30, item: 'santões', slug: 'santoes' },
      { qtd: 30, item: 'colinhas', slug: 'colinhas' },
      { qtd: 5, item: 'praguinhas de celular', slug: 'praguinhas' },
      { qtd: 3, item: 'pragões', slug: 'pragoes' },
    ],
  },
  {
    slug: 'g',
    nome: 'Kit G',
    resumo: 'Para quem já tem um grupo ajudando na distribuição.',
    itens: [
      { qtd: 50, item: 'santões', slug: 'santoes' },
      { qtd: 50, item: 'colinhas', slug: 'colinhas' },
      { qtd: 5, item: 'praguinhas de celular', slug: 'praguinhas' },
      { qtd: 4, item: 'pragões', slug: 'pragoes' },
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
  { slug: 'adesivo_carro', rotulo: 'Perfurado de vidro traseiro' },
  { slug: 'adesivo_parachoque', rotulo: 'Adesivo de parachoque' },
];

/** Opções dos campos de escolha — usadas no form e validadas no servidor. */
export const opcoes = {
  /**
   * Um adesivo só, e explícito: perfurado de vidro traseiro, sim ou não.
   * Adesivo de moto saiu porque cada formato vira um padrão de envio
   * diferente — junto ficam caros e travam a produção. O de parachoque
   * entrou como uma segunda pergunta separada (ver adesivoParachoque).
   */
  adesivoCarro: [
    { valor: 'sim', rotulo: 'Sim, quero o perfurado de vidro traseiro' },
    { valor: 'nao', rotulo: 'Não, quero receber só o kit' },
  ],
  adesivoParachoque: [
    { valor: 'sim', rotulo: 'Sim, quero o adesivo de parachoque' },
    { valor: 'nao', rotulo: 'Não, quero receber só o kit' },
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
