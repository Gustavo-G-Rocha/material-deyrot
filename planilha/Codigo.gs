/**
 * Cópia dos pedidos no Google Planilhas.
 *
 * Este script mora dentro da planilha (Extensões → Apps Script) e baixa o CSV
 * de /api/admin/export.csv a cada 15 minutos, reescrevendo a aba inteira.
 * É uma cópia espelhada: o Postgres continua sendo a fonte da verdade e
 * mudanças de status feitas no /admin aparecem aqui na sincronização seguinte.
 *
 * Nada é gravado de volta no banco — editar a planilha não altera o pedido.
 */

var PROPS = PropertiesService.getScriptProperties();
var ABA_PADRAO = 'Pedidos';

/** Colunas que o Sheets estragaria ao adivinhar tipo (some o zero à esquerda). */
var COLUNAS_TEXTO = ['whatsapp', 'whatsapp_digitos', 'cep', 'numero'];

var FUSO = 'America/Sao_Paulo';

// --- menu ----------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pedidos')
    .addItem('Sincronizar agora', 'sincronizarComAviso')
    .addSeparator()
    .addItem('Configurar acesso…', 'configurarAcesso')
    .addItem('Ligar sincronização automática', 'ligarAutomatico')
    .addItem('Desligar sincronização automática', 'desligarAutomatico')
    .addToUi();
}

function configurarAcesso() {
  var ui = SpreadsheetApp.getUi();

  var endereco = ui.prompt(
    'Endereço do site',
    'Ex.: https://seu-app.up.railway.app (sem barra no fim)',
    ui.ButtonSet.OK_CANCEL);
  if (endereco.getSelectedButton() !== ui.Button.OK) return;

  var token = ui.prompt(
    'ADMIN_TOKEN',
    'O mesmo valor da variável ADMIN_TOKEN no Railway.',
    ui.ButtonSet.OK_CANCEL);
  if (token.getSelectedButton() !== ui.Button.OK) return;

  PROPS.setProperties({
    BASE_URL: endereco.getResponseText().trim().replace(/\/+$/, ''),
    ADMIN_TOKEN: token.getResponseText().trim(),
  });

  ui.alert('Pronto. Agora use "Sincronizar agora".');
}

function sincronizarComAviso() {
  sincronizar();
  SpreadsheetApp.getActive().toast('Pedidos atualizados.', 'Sincronização', 5);
}

// --- sincronização -------------------------------------------------------

/** Chamada pelo gatilho de tempo e pelo menu. */
function sincronizar() {
  // Duas execuções ao mesmo tempo reescreveriam a aba uma por cima da outra.
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(30000)) return;

  try {
    cargaCompleta();
  } finally {
    trava.releaseLock();
  }
}

/** Miolo da sincronização, sem travar — quem chama já segurou a trava. */
function cargaCompleta() {
  var linhas = Utilities.parseCsv(baixarCsv(), ';');
  if (!linhas.length || !linhas[0].length) {
    throw new Error('O CSV veio vazio — a aba foi mantida como estava.');
  }
  escrever(linhas);
}

function baixarCsv() {
  var base = PROPS.getProperty('BASE_URL');
  var token = PROPS.getProperty('ADMIN_TOKEN');
  if (!base || !token) {
    throw new Error('Falta configurar. Menu Pedidos → "Configurar acesso…".');
  }

  var resposta = UrlFetchApp.fetch(base + '/api/admin/export.csv', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
    followRedirects: true,
  });

  var codigo = resposta.getResponseCode();
  if (codigo === 401) {
    throw new Error('Token recusado (401). Confira o ADMIN_TOKEN do Railway.');
  }
  if (codigo === 503) {
    throw new Error('O site está em modo vitrine (sem banco conectado).');
  }
  if (codigo !== 200) {
    throw new Error('O servidor respondeu ' + codigo + ': '
      + resposta.getContentText().slice(0, 200));
  }

  // O endpoint manda BOM para o Excel; no parseCsv ele vira lixo no 1º cabeçalho.
  return resposta.getContentText('UTF-8').replace(/^﻿/, '');
}

function abaPedidos() {
  var planilha = SpreadsheetApp.getActive();
  var nome = PROPS.getProperty('ABA') || ABA_PADRAO;
  return planilha.getSheetByName(nome) || planilha.insertSheet(nome);
}

/** O formato tem que ser aplicado ANTES do setValues, senão "01234" vira 1234. */
function aplicarFormatoTexto(aba, cabecalho, linha, quantasLinhas) {
  cabecalho.forEach(function (nome, i) {
    if (COLUNAS_TEXTO.indexOf(nome) !== -1) {
      aba.getRange(linha, i + 1, quantasLinhas, 1).setNumberFormat('@');
    }
  });
}

function escrever(linhas) {
  var aba = abaPedidos();

  var largura = linhas.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
  var grade = linhas.map(function (l) {
    var falta = largura - l.length;
    return falta > 0 ? l.concat(new Array(falta).fill('')) : l;
  });

  if (aba.getMaxRows() < grade.length) {
    aba.insertRowsAfter(aba.getMaxRows(), grade.length - aba.getMaxRows());
  }
  if (aba.getMaxColumns() < largura) {
    aba.insertColumnsAfter(aba.getMaxColumns(), largura - aba.getMaxColumns());
  }

  aba.clearContents();

  var alturaToda = aba.getMaxRows();
  aba.getRange(1, 1, alturaToda, largura).setNumberFormat('General');
  aplicarFormatoTexto(aba, grade[0], 1, alturaToda);

  aba.getRange(1, 1, grade.length, largura).setValues(grade);
  aba.getRange(1, 1, 1, largura).setFontWeight('bold');
  aba.setFrozenRows(1);
  aba.getRange(1, 1).setNote(
    'Última sincronização: '
    + Utilities.formatDate(new Date(), FUSO, 'dd/MM/yyyy HH:mm')
    + '\n' + (grade.length - 1) + ' pedido(s)');
}

// --- gatilho -------------------------------------------------------------

function ligarAutomatico() {
  desligarAutomatico();
  ScriptApp.newTrigger('sincronizar').timeBased().everyMinutes(15).create();
  SpreadsheetApp.getUi().alert('Sincronização automática a cada 15 minutos ligada.');
}

function desligarAutomatico() {
  ScriptApp.getProjectTriggers().forEach(function (gatilho) {
    if (gatilho.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(gatilho);
  });
}

// --- recebimento em tempo real -------------------------------------------

/**
 * Web App: o servidor chama esta função assim que grava o pedido no Postgres,
 * então a linha aparece na planilha na hora, sem esperar os 15 minutos.
 *
 * A implantação tem que ser "Executar como: eu" e "Quem pode acessar: qualquer
 * pessoa" — é por isso que o corpo traz um segredo, conferido contra o mesmo
 * ADMIN_TOKEN configurado no menu. Sem ele, qualquer um com o endereço /exec
 * conseguiria despejar linha falsa na planilha.
 *
 * Nada aqui volta para o banco: se a planilha e o Postgres divergirem, a
 * próxima sincronização apaga a aba e reescreve tudo a partir do CSV.
 */
function doPost(e) {
  try {
    var corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (!corpo.segredo || corpo.segredo !== PROPS.getProperty('ADMIN_TOKEN')) {
      return responder({ ok: false, erro: 'segredo invalido' });
    }

    var pedido = corpo.pedido || {};
    if (!pedido.id) return responder({ ok: false, erro: 'pedido sem id' });

    // Duas chegadas ao mesmo tempo escreveriam as duas na mesma linha.
    var trava = LockService.getScriptLock();
    if (!trava.tryLock(30000)) return responder({ ok: false, erro: 'ocupado' });

    try {
      return responder(anexar(pedido));
    } finally {
      trava.releaseLock();
    }
  } catch (err) {
    return responder({ ok: false, erro: String(err.message || err) });
  }
}

/** Abrir o /exec no navegador cai aqui — serve para conferir a implantação. */
function doGet() {
  return responder({ ok: true, servico: 'copia de pedidos', metodo: 'use POST' });
}

function anexar(pedido) {
  var aba = abaPedidos();

  // Planilha ainda vazia: não há cabeçalho para alinhar, então faz a carga
  // completa do CSV — que já traz este pedido junto.
  if (aba.getLastRow() < 1 || !aba.getRange(1, 1).getValue()) {
    cargaCompleta();
    return { ok: true, modo: 'sincronizacao-completa' };
  }

  var cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var colunaId = cabecalho.indexOf('id');

  // O servidor pode reenviar; não queremos o mesmo pedido duas vezes.
  if (colunaId !== -1 && jaTem(aba, colunaId + 1, pedido.id)) {
    return { ok: true, modo: 'ja-existia' };
  }

  var linha = cabecalho.map(function (nome) {
    var valor = pedido[nome];
    if (valor === null || valor === undefined) return '';
    // O CSV escreve booleano como texto; aqui igual, senão a coluna fica mista.
    if (valor === true) return 'true';
    if (valor === false) return 'false';
    return valor;
  });

  var destino = aba.getLastRow() + 1;
  if (aba.getMaxRows() < destino) aba.insertRowsAfter(aba.getMaxRows(), 1);
  aplicarFormatoTexto(aba, cabecalho, destino, 1);
  aba.getRange(destino, 1, 1, cabecalho.length).setValues([linha]);

  return { ok: true, modo: 'anexado', linha: destino };
}

function jaTem(aba, coluna, id) {
  if (aba.getLastRow() < 2) return false;
  var valores = aba.getRange(2, coluna, aba.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0]) === String(id)) return true;
  }
  return false;
}

function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
