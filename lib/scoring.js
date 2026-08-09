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

  if (p.adesivo_carro === 'quero') nota += 1 + Math.min(Number(p.qtd_carros) || 0, 3) - 1;
  if (p.adesivo_moto === 'quero') nota += 1;

  return Math.max(0, nota);
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
