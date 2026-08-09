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

  // ---- etapa 3: adesivos ------------------------------------------------
  d.adesivo_carro = texto(body.adesivo_carro);
  if (!valoresDe(opcoes.adesivoCarro).includes(d.adesivo_carro)) {
    erros.adesivo_carro = 'Escolha uma opção para o adesivo de carro.';
  }
  d.qtd_carros = d.adesivo_carro === 'quero'
    ? Math.min(Math.max(parseInt(body.qtd_carros, 10) || 1, 1), 20)
    : 0;

  d.adesivo_moto = texto(body.adesivo_moto);
  if (!valoresDe(opcoes.adesivoMoto).includes(d.adesivo_moto)) {
    erros.adesivo_moto = 'Escolha uma opção para o adesivo de moto.';
  }
  d.qtd_motos = d.adesivo_moto === 'quero'
    ? Math.min(Math.max(parseInt(body.qtd_motos, 10) || 1, 1), 20)
    : 0;

  // ---- etapa 4: perfil --------------------------------------------------
  const escolha = (campo, lista, msg) => {
    d[campo] = texto(body[campo]);
    if (!valoresDe(lista).includes(d[campo])) erros[campo] = msg;
  };
  escolha('disponibilidade', opcoes.disponibilidade, 'Selecione sua disponibilidade.');
  escolha('contatos', opcoes.contatos, 'Selecione quantas pessoas você alcança.');
  escolha('distribuidores', opcoes.distribuidores, 'Selecione uma opção.');
  escolha('mora_condominio', opcoes.simNao, 'Selecione uma opção.');

  d.unidades_condominio = d.mora_condominio === 'sim'
    ? (parseInt(body.unidades_condominio, 10) || null)
    : null;
  if (d.unidades_condominio !== null && (d.unidades_condominio < 1 || d.unidades_condominio > 5000)) {
    erros.unidades_condominio = 'Número de unidades inválido.';
  }

  // ---- etapa 5: kit -----------------------------------------------------
  d.kit = texto(body.kit);
  if (!kitPorSlug(d.kit)) erros.kit = 'Escolha um kit.';

  // ---- etapa 6: consentimento ------------------------------------------
  d.aceite_lgpd = body.aceite_lgpd === true || body.aceite_lgpd === 'true' || body.aceite_lgpd === 1 ? 1 : 0;
  if (!d.aceite_lgpd) {
    erros.aceite_lgpd = 'É necessário autorizar o uso dos dados para o envio.';
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: d };
}
