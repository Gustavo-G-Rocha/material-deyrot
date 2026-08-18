/**
 * Cópia em tempo real do pedido na planilha do Google.
 *
 * O envio é "dispara e esquece" de propósito: a resposta ao apoiador não pode
 * ficar presa esperando o Google. Se a planilha estiver fora do ar, o pedido
 * já está salvo no Postgres e a sincronização automática (a cada 15 min)
 * coloca a linha lá depois. O log serve só para você saber que aconteceu.
 */

import { integracoes } from '../config.js';

const URL_PLANILHA = integracoes.planilhaUrl || '';
const SEGREDO = process.env.ADMIN_TOKEN || 'trocar-este-token';

export const temPlanilha = Boolean(URL_PLANILHA);

export function enviarParaPlanilha(pedido) {
  if (!temPlanilha) return;

  fetch(URL_PLANILHA, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ segredo: SEGREDO, pedido }),
    // O /exec do Apps Script sempre responde 302 para googleusercontent.com.
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })
    .then(async (resposta) => {
      const bruto = (await resposta.text()).slice(0, 300);
      let corpo = {};
      try {
        corpo = JSON.parse(bruto);
      } catch {
        // Quando a implantação está errada o Google devolve uma página HTML.
      }
      if (!resposta.ok || !corpo.ok) {
        console.error(`[planilha] pedido ${pedido.id} não entrou (HTTP ${resposta.status}):`,
          corpo.erro || bruto);
      }
    })
    .catch((err) => {
      console.error(`[planilha] pedido ${pedido.id} não entrou:`, err.message);
    });
}
