import { opcoes, UFS } from '../config.js';
import { kitPorSlug } from './scoring.js';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const texto = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

const valoresDe = (lista) => lista.map((o) => o.valor);

/**
 * Valida e normaliza o corpo do pedido.
 * Retorna { ok: true, dados } ou { ok: false, erros: { campo: mensagem } }.
 */
export function validarPedido(body) {
  const erros = {};
  const d = {};

  // ---- etapa 1: contato -------------------------------------------------
  d.nome = texto(body.nome);
  if (d.nome.length < 3) erros.nome = 'Informe seu nome completo.';
  else if (!d.nome.includes(' ')) erros.nome = 'Informe nome e sobrenome.';

  d.email = texto(body.email).toLowerCase();
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(d.email)) {
    erros.email = 'E-mail inválido.';
  }

  d.whatsapp = texto(body.whatsapp);
  d.whatsapp_digitos = soDigitos(d.whatsapp);
  if (d.whatsapp_digitos.length < 10 || d.whatsapp_digitos.length > 13) {
    erros.whatsapp = 'WhatsApp inválido. Use DDD + número.';
  }

  // ---- etapa 2: entrega -------------------------------------------------
  d.cep = soDigitos(body.cep);
  if (d.cep.length !== 8) erros.cep = 'CEP deve ter 8 dígitos.';

  d.uf = texto(body.uf).toUpperCase();
  if (!UFS.includes(d.uf)) erros.uf = 'Selecione um estado.';

  d.cidade = texto(body.cidade);
  if (d.cidade.length < 2) erros.cidade = 'Informe a cidade.';

  d.endereco = texto(body.endereco);
  if (d.endereco.length < 3) erros.endereco = 'Informe o endereço.';

  d.numero = texto(body.numero);
  if (!d.numero) erros.numero = 'Informe o número (ou "S/N").';

  d.complemento = texto(body.complemento) || null;
  d.bairro = texto(body.bairro) || null;

  // ---- adesivos -------------------------------------------------------
  // O formulário não pergunta mais: ninguém pede perfurado ou parachoque por
  // aqui. As colunas ficam (ver kits/CSV) para registro manual no painel,
  // então um valor ausente ou inválido vira 'não' em vez de erro.
  const escolha = (campo, lista, msg) => {
    d[campo] = texto(body[campo]);
    if (!valoresDe(lista).includes(d[campo])) erros[campo] = msg;
  };
  const escolhaOpcional = (campo, lista) => {
    const valor = texto(body[campo]);
    d[campo] = valoresDe(lista).includes(valor) ? valor : 'nao';
  };
  escolhaOpcional('adesivo_carro', opcoes.adesivoCarro);
  d.qtd_carros = d.adesivo_carro === 'sim' ? 1 : 0;

  escolhaOpcional('adesivo_parachoque', opcoes.adesivoParachoque);
  d.qtd_parachoques = d.adesivo_parachoque === 'sim' ? 1 : 0;

  // ---- etapa 3: alcance -------------------------------------------------
  // Só uma flag de quantas pessoas o pedido tende a alcançar — não define
  // mais o tamanho do kit, todo pedido sai como Kit M (ver kit abaixo).
  escolha('alcance', opcoes.alcance, 'Selecione uma opção.');

  // ---- kit ------------------------------------------------------------
  // O formulário não pergunta mais o perfil de quem pede: todo pedido sai
  // como Kit M, então o valor não vem (nem é confiável vir) do cliente.
  d.kit = 'm';
  d.kit_recomendado = 'm';
  d.engajamento = 0;
  if (!kitPorSlug(d.kit)) erros.kit = 'Kit indisponível no momento.';

  // ---- etapa 1: consentimento (LGPD) ------------------------------------
  d.aceite_lgpd = body.aceite_lgpd === true || body.aceite_lgpd === 'true' || body.aceite_lgpd === 1 ? 1 : 0;
  if (!d.aceite_lgpd) {
    erros.aceite_lgpd = 'É necessário autorizar o uso dos dados para o envio.';
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: d };
}
