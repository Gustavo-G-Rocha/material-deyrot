import { kits } from '../config.js';

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

/** Se a pessoa pediu o adesivo de parachoque. Só há um por pedido. */
export function querParachoque(p) {
  return p?.adesivo_parachoque === 'sim';
}

export function kitPorSlug(slug) {
  return kits.find((k) => k.slug === slug) || null;
}
