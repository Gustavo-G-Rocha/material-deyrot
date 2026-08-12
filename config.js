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
      nome: 'NOME DO CANDIDATO 1',
      cargo: 'Deputado Federal',
      numero: '00000',
      foto: '/assets/candidato-1.png', // troque pelo arquivo real em public/assets/
    },
    {
      nome: 'NOME DO CANDIDATO 2',
      cargo: 'Deputado Estadual',
      numero: '00000',
      foto: '/assets/candidato-2.png',
    },
  ],

  partido: 'SIGLA',
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
    acento: '#2f7df6',
    acentoClaro: '#5b9bff',
    acentoEscuro: '#1b56b8',
    acentoTinta: '#08111f',   // cor do texto escrito por cima do acento
    fundo: '#0b0d12',
    fundo2: '#12151d',
    fundo3: '#1a1f2b',
    tinta: '#f2f4f8',
    tintaFraca: '#a4adbe',
  },

  // ---- Links externos ----------------------------------------------------
  links: {
    whatsappGrupo: 'https://chat.whatsapp.com/SEU-LINK-AQUI',
    instagram: 'https://instagram.com/SEU-PERFIL',
    site: 'https://seusite.com.br',
    privacidade: 'https://seusite.com.br/politica-de-privacidade',
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
    { rotulo: 'Kits disponíveis', href: '#kits', nota: 'Os quatro tamanhos' },
    { rotulo: 'Adesivo de carro', href: '#adesivo', nota: 'Vidro traseiro perfurado' },
    { rotulo: 'Como funciona', href: '#como-funciona', nota: 'Do pedido à entrega' },
    // Outros portais da campanha, se houver:
    // { rotulo: 'Eventos', href: 'https://eventos.seusite.com.br', nota: 'eventos.seusite.com.br' },
    // { rotulo: 'Participe', href: 'https://participe.seusite.com.br', nota: 'participe.seusite.com.br' },
  ],

  // ---- Contato de suporte ------------------------------------------------
  suporte: {
    email: 'contato@seusite.com.br',
    whatsapp: '+55 11 90000-0000',
  },
};

/**
 * Kits disponíveis, do menor para o maior.
 * `pontos` é a nota mínima de engajamento para o kit ser recomendado
 * automaticamente (ver calcularEngajamento em lib/scoring.js).
 */
export const kits = [
  {
    slug: 'inicial',
    nome: 'Kit Inicial',
    resumo: 'Para quem está começando a divulgar entre conhecidos.',
    pontos: 0,
    itens: [
      { qtd: 100, item: 'panfletos' },
      { qtd: 20, item: 'adesivos' },
    ],
  },
  {
    slug: 'rua',
    nome: 'Kit Rua',
    resumo: 'Dá para cobrir a sua rua e o comércio mais próximo.',
    pontos: 4,
    itens: [
      { qtd: 300, item: 'panfletos' },
      { qtd: 60, item: 'adesivos' },
      { qtd: 1, item: 'bandeira' },
    ],
  },
  {
    slug: 'bairro',
    nome: 'Kit Bairro',
    resumo: 'Para quem já tem um grupo ajudando na distribuição.',
    pontos: 7,
    itens: [
      { qtd: 600, item: 'panfletos' },
      { qtd: 120, item: 'adesivos' },
      { qtd: 2, item: 'bandeiras' },
      { qtd: 1, item: 'camiseta' },
    ],
  },
  {
    slug: 'cidade',
    nome: 'Kit Cidade',
    resumo: 'Para quem coordena voluntários e abastece outras pessoas.',
    pontos: 10,
    itens: [
      { qtd: 1000, item: 'panfletos' },
      { qtd: 250, item: 'adesivos' },
      { qtd: 4, item: 'bandeiras' },
      { qtd: 2, item: 'camisetas' },
      { qtd: 1, item: 'faixa' },
    ],
  },
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

/** Config pública entregue ao navegador (nada sensível aqui). */
export function configPublica() {
  return { campanha, kits, opcoes, ufs: UFS };
}
