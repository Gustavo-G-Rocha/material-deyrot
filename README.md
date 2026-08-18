# Portal de Material de Campanha

Landing page + formulário de pedido em 6 etapas + Postgres + painel administrativo.
Única dependência: o driver `pg`.

## Subir no Railway (do zero)

```powershell
npm install -g @railway/cli
railway login
railway init
railway add --database postgres
railway variables --set "ADMIN_TOKEN=coloque-um-token-longo-aqui"
railway up
railway domain
```

O `railway add --database postgres` já cria a variável `DATABASE_URL` no projeto —
não precisa copiar senha para lugar nenhum. A tabela é criada sozinha no primeiro
boot (`migrar()` em [lib/db.js](lib/db.js)).

## Rodar na sua máquina

Sem instalar Postgres, usando o banco do Railway:

```powershell
railway run npm start
```

Com um Postgres seu:

```powershell
$env:DATABASE_URL = "postgresql://usuario:senha@localhost:5432/material"
$env:ADMIN_TOKEN  = "um-token-qualquer"
npm start
```

Site em `http://localhost:3000` · Painel em `http://localhost:3000/admin?token=SEU_TOKEN`

| Variável       | Obrigatória | Para que serve                                  |
|----------------|-------------|-------------------------------------------------|
| `DATABASE_URL` | sim         | Conexão com o Postgres                          |
| `ADMIN_TOKEN`  | sim         | Senha do painel e da exportação CSV             |
| `PORT`         | não (3000)  | Porta — o Railway injeta sozinho                |
| `DB_POOL_MAX`  | não (10)    | Conexões simultâneas no pool                    |
| `PLANILHA_URL` | não         | Web App que copia o pedido para o Google Planilhas |

> **Troque o `ADMIN_TOKEN` antes de colocar no ar.** Com o padrão, qualquer
> pessoa acessa a lista completa de nomes, telefones e endereços.

O TLS é resolvido sozinho: desligado para `*.railway.internal` e `localhost`,
ligado (com certificado auto-assinado aceito) para qualquer outro host.

## Trocar os candidatos

Tudo que aparece na tela vem de [config.js](config.js) — o HTML não tem nome de
candidato escrito. Edite lá:

- `campanha.candidatos[]` — nome, cargo, número e foto de cada candidato
- `campanha.partido`, `campanha.ano`, `campanha.uf`
- `campanha.tema` — cores (aplicadas como variáveis CSS)
- `campanha.links` — grupo de WhatsApp, Instagram, site
- `kits[]` — nome, itens e a nota mínima de engajamento de cada kit
- `opcoes` — alternativas dos campos de escolha (o servidor valida contra elas)

As imagens vão em [public/assets/](public/assets/) (veja o LEIA-ME de lá).

### Trocar a cor da campanha

Mexa em `campanha.tema.acento` no [config.js](config.js) e pronto — botões,
bordas, brilho do topo, selos, foco dos campos e barra de progresso acompanham.
Isso funciona porque [public/theme.css](public/theme.css) não tem cor literal
fora do `:root`: os tons derivados saem de `color-mix()` sobre `--acento`.

Os outros tokens (`acentoClaro`, `acentoEscuro`, `acentoTinta`) só valem a pena
ajustar se o contraste do gradiente ou do texto sobre a cor não ficar bom.

## Estrutura

```
config.js              configuração da campanha (candidatos, kits, cores, menu, links)
server.js              servidor HTTP e rotas
lib/db.js              Postgres: schema, migração, inserção, consultas, CSV
lib/planilha.js        envia o pedido recém-criado para a planilha do Google
lib/validacao.js       validação e normalização do formulário
lib/scoring.js         nota de engajamento e recomendação de kit
public/index.html      landing + formulário
public/app.js          formulário multi-etapas (renderizado a partir da config)
public/theme.css       tokens, botões, cabeçalho, painel de menu e rodapé
public/styles.css      componentes da página (hero, kits, formulário, revisão)
public/admin.html      painel administrativo
railway.json           build, start e healthcheck do Railway
.env.example           modelo das variáveis de ambiente
planilha/Codigo.gs     script que espelha os pedidos numa planilha do Google
```

## Ordem das seções

Hero → formulário → adesivo de carro → grade de kits → como funciona → CTA final → rodapé.

## Fluxo do formulário

1. **Contato** — nome, e-mail, WhatsApp (com máscara)
2. **Entrega** — CEP com preenchimento automático via ViaCEP, UF, cidade, bairro, endereço, número, complemento
3. **Adesivos** — carro e moto, com quantidade quando a pessoa quer adesivar
4. **Perfil** — tempo disponível, alcance, se repassa material, se mora em condomínio
5. **Kit** — quatro opções, com uma recomendada automaticamente pela nota
6. **Revisão** — resumo com botão "Corrigir" por bloco e o aceite de uso de dados

A nota de engajamento (0–14) é calculada no servidor em `lib/scoring.js` e serve
tanto para recomendar o kit quanto para ordenar a fila de envio no painel.

## Banco

Tabela `pedidos` no Postgres, uma linha por pedido, com uma coluna para cada campo
do formulário mais `engajamento`, `kit_recomendado`, `status`, `ip`, `user_agent` e
`criado_em`. Índice único em `whatsapp_digitos`, então o mesmo número não pede duas
vezes (a API responde `409`), e índice composto `(engajamento DESC, criado_em DESC)`
para a fila do painel.

Status possíveis: `novo`, `separado`, `enviado`, `entregue`, `cancelado` — garantidos
por `CHECK` na tabela e alteráveis direto no painel.

Para abrir o banco pelo terminal:

```powershell
railway connect postgres
```

```sql
SELECT uf, cidade, COUNT(*) FROM pedidos GROUP BY uf, cidade ORDER BY 3 DESC;
SELECT kit, SUM(qtd_carros) AS adesivos_carro FROM pedidos GROUP BY kit;
```

## Cópia dos pedidos no Google Planilhas

O script em [planilha/Codigo.gs](planilha/Codigo.gs) roda dentro da própria
planilha (Apps Script) e mantém a cópia por dois caminhos que se completam:

- **em tempo real** — assim que o pedido entra no Postgres, o servidor chama o
  Web App do script ([lib/planilha.js](lib/planilha.js)) e a linha aparece na
  hora. É "dispara e esquece": se o Google estiver fora, o pedido já está salvo
  e nada trava para o apoiador;
- **a cada 15 minutos** — o script baixa o `/api/admin/export.csv` e reescreve a
  aba inteira. Isso conserta qualquer envio perdido e traz as mudanças de status
  feitas no `/admin`.

Passo a passo em [planilha/LEIA-ME.md](planilha/LEIA-ME.md). O `ADMIN_TOKEN`
fica nas propriedades do script, não no repositório nem visível na planilha, e
é o mesmo segredo que autentica o envio em tempo real.

É espelho de leitura: editar a planilha não altera o banco, e a aba `Pedidos` é
apagada e reescrita a cada sincronização.

## API

| Método | Rota                     | Descrição                                    |
|--------|--------------------------|----------------------------------------------|
| GET    | `/api/config`            | Config pública (candidatos, kits, opções)    |
| GET    | `/api/cep/:cep`          | Consulta de CEP (ViaCEP)                     |
| POST   | `/api/recomendar`        | Nota de engajamento + kit sugerido           |
| POST   | `/api/pedidos`           | Cria o pedido                                |
| GET    | `/api/admin/pedidos`     | Lista + resumo (exige token)                 |
| POST   | `/api/admin/status`      | Muda o status de um pedido (exige token)     |
| GET    | `/api/admin/export.csv`  | Exporta tudo em CSV (exige token)            |

Proteções já incluídas: validação no servidor (o cliente não é confiável),
limite de 12 envios por IP a cada 10 minutos, campo honeypot contra bots,
limite de tamanho do corpo da requisição e bloqueio de path traversal.

## Antes de publicar

- [ ] Trocar `ADMIN_TOKEN` por um valor longo e aleatório
- [ ] Preencher `config.js` com os dados reais dos candidatos
- [ ] Colocar as imagens da campanha em `public/assets/` (fotos e artes próprias)
- [ ] Publicar a política de privacidade e apontar `campanha.links.privacidade` para ela
- [ ] Definir quem responde pelos dados — a LGPD vale para dado de campanha também
- [ ] Ligar backup do Postgres no Railway (aba do banco → Backups)

O HTTPS já vem pronto no domínio do Railway, o que importa aqui porque o
formulário coleta endereço residencial e telefone.
