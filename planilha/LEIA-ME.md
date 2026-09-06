# Cópia dos pedidos no Google Planilhas

Este script mora **dentro da planilha** e mantém a cópia de duas formas:

1. **Na hora** — o servidor avisa o script assim que grava o pedido no Postgres,
   e a linha aparece na planilha em segundos.
2. **A cada 15 minutos** — o script baixa o `/api/admin/export.csv` e reescreve
   a aba inteira. É a rede de segurança: recupera qualquer aviso perdido e traz
   as mudanças de status feitas no `/admin`.

Não precisa de conta de serviço do Google e não guarda credencial no
repositório — o `ADMIN_TOKEN` fica nas propriedades do script, dentro da conta
Google de quem instalar, e é o mesmo segredo que autentica o aviso em tempo real.

O Postgres continua sendo a fonte da verdade. A planilha é só espelho:
editar uma célula lá **não** altera o pedido no banco.

## Instalar (uma vez, ~3 minutos)

1. Crie uma planilha nova em <https://sheets.new> e dê um nome a ela.
2. Menu **Extensões → Apps Script**.
3. Apague o `function myFunction() {}` que vem pronto e cole todo o conteúdo de
   [Codigo.gs](Codigo.gs). Salve (ícone do disquete).
4. Volte para a planilha e **recarregue a página**. Vai aparecer um menu novo,
   **Pedidos**, ao lado de "Ajuda".
5. **Pedidos → Configurar acesso…** e informe:
   - o endereço do site (ex.: `https://seu-app.up.railway.app`);
   - o `ADMIN_TOKEN` cadastrado no Railway.
6. **Pedidos → Sincronizar agora.** Na primeira vez o Google pede autorização:
   escolha sua conta, clique em "Avançado" → "Acessar (não seguro)" — esse aviso
   aparece porque o script é seu e não passou por revisão do Google.
7. **Pedidos → Ligar sincronização automática** (roda a cada 15 minutos).

Se der erro, o Google manda um e-mail para o dono do script com a mensagem —
todas elas são explícitas ("Token recusado (401)", "modo vitrine", etc.).

## Ligar a cópia em tempo real

Isso publica o script como Web App, para o servidor conseguir avisar quando um
pedido entra. A sincronização dos 15 minutos continua valendo do mesmo jeito.

1. No editor do Apps Script: **Implantar → Nova implantação**.
2. Engrenagem ao lado de "Selecionar tipo" → **App da Web**.
3. Configure exatamente assim:
   - **Executar como:** Eu (sua conta) — é o que dá ao script acesso à planilha;
   - **Quem pode acessar:** Qualquer pessoa — o servidor do Railway não faz
     login no Google. A segurança vem do `ADMIN_TOKEN` conferido no `doPost`,
     não do sigilo do endereço.
4. **Implantar** e copie a URL que termina em `/exec`.
5. Cadastre essa URL no Railway:

```powershell
railway variables --set "PLANILHA_URL=https://script.google.com/macros/s/SEU_ID/exec"
```

   (a URL atual também está gravada em [config.js](../config.js), então isso só
   é necessário ao trocar de planilha)

Para conferir, abra a URL `/exec` no navegador: tem que responder
`{"ok":true,"servico":"copia de pedidos","metodo":"use POST"}`.

> **Ao editar o `Codigo.gs` depois de implantado**, salvar não basta: o `/exec`
> continua rodando a versão antiga. Vá em **Implantar → Gerenciar implantações
> → ✏️ (editar) → Versão: Nova versão → Implantar**. A URL não muda.

Nos logs do Railway, uma falha de envio aparece como
`[planilha] pedido 42 não entrou: ...`. Não é urgente: o pedido está salvo no
banco e a sincronização seguinte coloca a linha no lugar.

## O que vem na planilha

Uma linha por pedido, na aba `Pedidos`, com **todas** as colunas da tabela —
inclusive `ip` e `user_agent`. Se quiser esconder, é só ocultar as colunas na
planilha (a sincronização preserva a ocultação, porque só reescreve valores).

`whatsapp`, `whatsapp_digitos`, `cep` e `numero` são gravados como texto de
propósito: sem isso o Sheets come o zero à esquerda e transforma telefone em
notação científica.

Filtro, tabela dinâmica, formatação condicional e gráficos podem ser criados
normalmente — o script só troca os valores, não mexe em formatação nem em
outras abas. Se for montar contas em cima, faça numa **segunda aba** com
fórmulas apontando para `Pedidos`, porque a aba `Pedidos` é apagada e
reescrita a cada sincronização.

## Compartilhar com a equipe

Compartilhe a **planilha**, não o token. Quem recebe acesso de leitor vê os
dados e não consegue abrir o painel nem o script.

> Lembre que a planilha passa a conter nome, telefone e endereço residencial de
> apoiadores. Vale o mesmo cuidado da LGPD que se aplica ao painel: acesso só
> para quem precisa, e nada de link "qualquer pessoa com o link".

## Alternativa de 30 segundos (sem script)

Cole numa célula A1 de uma planilha:

```
=IMPORTDATA("https://seu-app.up.railway.app/api/admin/export.csv?token=SEU_TOKEN"; ";")
```

Funciona e atualiza sozinho, mas o token fica visível na fórmula para todo mundo
que abrir a planilha, e os telefones perdem o zero à esquerda. Serve para dar
uma olhada rápida; para a cópia de verdade, use o script.
