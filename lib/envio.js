/**
 * Quanto de cada item sai de fato para cada pedido.
 *
 * O padrão vem do kit escolhido mais os adesivos pedidos. Quem opera o painel
 * pode sobrescrever item a item — é isso que vai para o CSV que alimenta o
 * sistema de logística, então o que vale é sempre o número daqui, não o que a
 * pessoa pediu no formulário.
 *
 * O ajuste fica numa coluna JSONB e guarda só o que foi mexido. Assim, mudar a
 * composição de um kit no config.js reflete em todo pedido que ninguém editou,
 * sem precisar tocar no banco.
 */

import { kits, itensEnvio } from '../config.js';

export const SLUGS = itensEnvio.map((i) => i.slug);

const TETO = 999;

/** Quantidades que o pedido teria sem ninguém mexer: o kit + os adesivos. */
export function envioPadrao(pedido) {
  const saida = Object.fromEntries(SLUGS.map((s) => [s, 0]));

  const kit = kits.find((k) => k.slug === pedido.kit);
  for (const item of kit?.itens || []) {
    if (item.slug && item.slug in saida) saida[item.slug] = item.qtd;
  }

  // Adesivo só entra se a pessoa quis; "tenho carro mas prefiro outros" não conta.
  if (pedido.adesivo_carro === 'quero') saida.adesivo_carro = Number(pedido.qtd_carros) || 0;
  if (pedido.adesivo_moto === 'quero') saida.adesivo_moto = Number(pedido.qtd_motos) || 0;

  return saida;
}

/** Descarta slug desconhecido e número fora da faixa — o corpo vem do navegador. */
export function sanearEnvio(bruto) {
  const saida = {};
  for (const slug of SLUGS) {
    if (bruto == null || !(slug in bruto)) continue;
    const n = Math.trunc(Number(bruto[slug]));
    if (Number.isFinite(n)) saida[slug] = Math.min(Math.max(n, 0), TETO);
  }
  return saida;
}

/** O que realmente vai ser despachado: o padrão com os ajustes por cima. */
export function envioEfetivo(pedido) {
  const padrao = envioPadrao(pedido);
  return pedido.envio ? { ...padrao, ...sanearEnvio(pedido.envio) } : padrao;
}

/** true quando alguém mexeu na quantidade de algum item. */
export function foiEditado(pedido) {
  if (!pedido.envio) return false;
  const padrao = envioPadrao(pedido);
  const ajuste = sanearEnvio(pedido.envio);
  return Object.entries(ajuste).some(([slug, qtd]) => qtd !== padrao[slug]);
}
