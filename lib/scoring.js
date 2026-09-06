import { kits, opcoes } from '../config.js';

function pontosDe(lista, valor) {
  const achado = lista.find((o) => o.valor === valor);
  return achado?.pontos ?? 0;
}

/**
 * Nota de engajamento (0 a ~14) a partir das respostas da etapa de perfil.
 * Serve para recomendar um kit e para priorizar a fila de envio.
 */
export function calcularEngajamento(p) {
  let nota = 0;

  nota += pontosDe(opcoes.disponibilidade, p.disponibilidade);
  nota += pontosDe(opcoes.contatos, p.contatos);
  nota += pontosDe(opcoes.distribuidores, p.distribuidores);

  if (p.mora_condominio === 'sim') {
    nota += 1;
    const unidades = Number(p.unidades_condominio) || 0;
    if (unidades >= 100) nota += 2;
    else if (unidades >= 30) nota += 1;
  }

  if (querPerfurado(p)) nota += 1;

  return Math.max(0, nota);
}

/**
 * Se a pessoa pediu o perfurado de vidro traseiro.
 *
 * O formulário hoje só responde 'sim'/'nao', mas os pedidos antigos gravaram
 * 'quero' quando a pergunta ainda listava quatro opções de adesivo de carro —
 * por isso os dois valores contam como sim. Só há um perfurado por pedido.
 */
export function querPerfurado(p) {
  return p?.adesivo_carro === 'sim' || p?.adesivo_carro === 'quero';
}

/** Kit recomendado para uma nota de engajamento. */
export function kitRecomendado(nota) {
  let escolhido = kits[0];
  for (const kit of kits) {
    if (nota >= kit.pontos) escolhido = kit;
  }
  return escolhido;
}

export function kitPorSlug(slug) {
  return kits.find((k) => k.slug === slug) || null;
}

/** Posição do kit na escala P < M < G. Kit desconhecido fica em -1. */
export function nivelKit(slug) {
  return kits.findIndex((k) => k.slug === slug);
}

/**
 * true quando a pessoa escolheu um kit acima do que as respostas dela pedem.
 *
 * Esse pedido não é gravado: ele iria direto para a pré-expedição e alguém
 * teria que parar a fila para conferir um por um. Em vez disso a pessoa é
 * mandada para o WhatsApp da produção, que confirma e cadastra à mão.
 */
export function kitAcimaDoRecomendado(escolhido, recomendado) {
  const a = nivelKit(escolhido);
  const b = nivelKit(recomendado);
  return a >= 0 && b >= 0 && a > b;
}
