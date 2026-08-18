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

Site em `http://localhost:3000` · Painel em `http://localhost:3000/admin`

| Variável          | Obrigatória | Para que serve                                     |
|-------------------|-------------|----------------------------------------------------|
| `DATABASE_URL`    | sim         | Conexão com o Postgres                             |
| `ADMIN_TOKEN`     | sim         | Assina a sessão do painel e libera o CSV para integrações |
| `PORT`            | não (3000)  | Porta — o Railway injeta sozinho                   |
| `DB_POOL_MAX`     | não (10)    | Conexões simultâneas no pool                       |
| `PLANILHA_URL`    | não         | Web App que copia o pedido para o Google Planilhas |
| `SESSAO_SEGREDO`  | não         | Chave que assina o cookie (por padrão usa o `ADMIN_TOKEN`) |

> **Troque o `ADMIN_TOKEN` antes de colocar no ar.** Ele assina os cookies de
> sessão e libera o `export.csv` para integrações — com o valor padrão,
> qualquer pessoa baixa a lista completa de nomes, telefones e endereços.

Trocar o `ADMIN_TOKEN` também desloga todo mundo, o que é justamente o que se
quer se alguma sessão vazar.

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
lib/auth.js            login do painel: hash de senha e cookie de sessão
lib/envio.js           quantidades a despachar: padrão do kit e ajuste manual
lib/planilha.js        envia o pedido recém-criado para a planilha do Google
lib/validacao.js       validação e normalização do formulário
lib/scoring.js         nota de engajamento e recomendação de kit
scripts/senha.js       gera o hash de uma senha nova (npm run senha)
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
por `CHECK` na tabela e alteráveis direto no painel. A conferência antifraude usa
`revisao` (`pendente`, `aprovado`, `suspeito`), também com `CHECK`, mais
`revisado_por` e `revisado_em`. As colunas são criadas por `ALTER TABLE ... IF NOT
EXISTS` no boot, então bancos antigos migram sozinhos no deploy.

Para abrir o banco pelo terminal:

```powershell
railway connect postgres
```

```sql
SELECT uf, cidade, COUNT(*) FROM pedidos GROUP BY uf, cidade ORDER BY 3 DESC;
SELECT kit, SUM(qtd_carros) AS adesivos_carro FROM pedidos GROUP BY kit;
```

## Painel /admin

Entra por e-mail e senha, e só quem está em `acessos` no [config.js](config.js)
entra — hoje são dois: Pedro Deyrot e a campanha do Will Rocha.

Dentro tem os cartões de resumo, a tabela com **todos** os campos do pedido
(rola para o lado), o filtro por status, a troca de status linha a linha e o
botão de baixar CSV.

A senha não fica guardada em lugar nenhum: o `config.js` só tem um hash scrypt
com sal. Para trocar a senha de alguém, ou dar acesso a mais uma pessoa:

```powershell
npm run senha "a senha nova"
```

e cole o `hash:` que ele imprime na linha da pessoa, em `acessos`. Tirar alguém
da lista derruba a sessão dela no clique seguinte.

A sessão dura 12 horas, num cookie `HttpOnly` assinado — não há tabela de
sessões, então deploy e restart não deslogam ninguém. O login aceita 8
tentativas por IP a cada 10 minutos.

O `?token=` antigo não abre mais o painel; ele continua valendo só para
`GET /api/admin/export.csv`, que é como a planilha do Google busca os dados.

### Quantidades a despachar

A coluna **Vai enviar** mostra quantas peças saem no total; o ✎ abre um editor
com um campo por item, e o que você digitar ali é o que vale — não o que a
pessoa pediu no formulário. "Voltar ao padrão do kit" desfaz o ajuste.

O padrão de cada pedido é o kit escolhido mais os adesivos que a pessoa quis
(adesivo só entra com a resposta "quero"). Só o **ajuste** é gravado, numa
coluna JSONB, e o resto continua saindo do [config.js](config.js) — então mudar
a composição de um kit reflete em todo pedido que ninguém editou, sem migração.

O catálogo do que existe para despachar é `itensEnvio` no config.js. Item novo:
acrescente lá e nos kits que o usam; o painel e o CSV se ajustam sozinhos.

### CSV para outro sistema

A exportação troca a coluna JSON `envio` por **uma coluna por item**, já com o
valor que vale — número puro, sem JSON para interpretar do outro lado:

```
env_santoes;env_colinhas;env_praguinhas;env_pragoes;env_parachoques;env_adesivo_carro;env_adesivo_moto;envio_editado
```

`envio_editado` é `sim`/`nao` e diz se alguém mexeu naquele pedido ou se ele
saiu no padrão do kit. Pedido nunca editado também vem com os números
preenchidos, então o sistema de destino nunca recebe campo vazio.

### Conferência antifraude

Cada pedido tem um campo `revisao` — `pendente`, `aprovado` ou `suspeito` — que
se muda direto na tabela, junto de uma observação livre. Fica gravado **quem**
conferiu e **quando** (`revisado_por`, `revisado_em`), então a decisão tem dono.
Dá para filtrar a lista por revisão e o cartão "A conferir" mostra quantos ainda
estão pendentes.

A coluna **Sinais** marca sozinha o que merece uma olhada:

| Sinal | O que significa |
|---|---|
| `N× mesmo IP` | Mais de um pedido da mesma conexão |
| `N× mesmo endereço` | Mesmo CEP + número + complemento (a porta exata) |
| `N× mesmo nome` / `mesmo e-mail` | Repetido com WhatsApp diferente |
| `perfil no máximo` | Respondeu o topo nas três perguntas de perfil, o que infla a nota e o kit |
| `pediu G, sugerido P` | Escolheu kit maior do que o perfil indicava |
| `sem navegador` | Chegou sem `user_agent` — cara de envio automatizado |
| `N unidades` | Condomínio com 300+ unidades, que soma pontos na nota |

**Nada é bloqueado automaticamente.** Nenhum desses sinais prova fraude sozinho:
uma família divide IP e endereço, e o WhatsApp duplicado já é barrado no banco
por índice único. Os sinais existem para direcionar a conferência humana — quem
decide é quem está no painel, e a linha suspeita fica destacada em vermelho.

As contagens são calculadas sobre a tabela inteira (funções de janela em
[lib/db.js](lib/db.js)), não só sobre a página exibida — senão o terceiro pedido
de um mesmo IP passaria limpo por estar na página seguinte.

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
| POST   | `/api/admin/login`       | Entra no painel (e-mail e senha)             |
| POST   | `/api/admin/logout`      | Sai do painel                                |
| GET    | `/api/admin/eu`          | Quem está logado                             |
| GET    | `/api/admin/pedidos`     | Lista + resumo (exige login)                 |
| POST   | `/api/admin/status`      | Muda o status de um pedido (exige login)     |
| POST   | `/api/admin/revisao`     | Marca a conferência antifraude (exige login) |
| POST   | `/api/admin/envio`       | Ajusta as quantidades a despachar (exige login) |
| GET    | `/api/admin/export.csv`  | Exporta tudo em CSV (login ou ADMIN_TOKEN)   |

Proteções já incluídas: validação no servidor (o cliente não é confiável),
limite de 12 envios por IP a cada 10 minutos, campo honeypot contra bots,
limite de tamanho do corpo da requisição e bloqueio de path traversal.

## Antes de publicar

- [ ] Trocar `ADMIN_TOKEN` por um valor longo e aleatório
- [ ] Trocar as senhas de `acessos` por senhas que não circularam por chat
- [ ] Preencher `config.js` com os dados reais dos candidatos
- [ ] Colocar as imagens da campanha em `public/assets/` (fotos e artes próprias)
- [ ] Publicar a política de privacidade e apontar `campanha.links.privacidade` para ela
- [ ] Definir quem responde pelos dados — a LGPD vale para dado de campanha também
- [ ] Ligar backup do Postgres no Railway (aba do banco → Backups)

O HTTPS já vem pronto no domínio do Railway, o que importa aqui porque o
formulário coleta endereço residencial e telefone.
