# GenVagas

Tracking pessoal de candidaturas a vagas de emprego. Um kanban de 5 fases — candidatado, contato feito, entrevistando, proposta, encerrado — onde você arrasta o card e a fase é atualizada.

**Zero dependências.** Sem `package.json`, sem `node_modules`, sem build. Só Node.js 22+ e um arquivo `.db`.

```bash
node server.mjs
# GenVagas rodando em http://localhost:3000
```

## Por que zero dependências

Eu me candidato a muitas vagas e queria um lugar só meu pra acompanhar isso — não um SaaS de terceiros dono dos meus dados de carreira. Tendo decidido construir, a pergunta virou: **quanto de stack eu realmente preciso?**

A resposta foi: quase nada.

- **Node.js 22+** traz `node:sqlite` embutido. Não preciso do `better-sqlite3` (que compila binário nativo e exige build tools na máquina de quem clona).
- **HTML server-renderizado** não precisa de framework. Um `http.createServer` mais uma tabela de rotas resolvem as 13 rotas.
- **Tailwind via CDN** dá o visual sem `npm run build`.
- **HTML5 drag-and-drop** é nativo. Não precisa de SortableJS.

O resultado: `git clone` e `node server.mjs`. Nada entre você e o app rodando.

## Como rodar

Requisito: **Node.js 22 ou superior** (o `node:sqlite` é novo).

```bash
git clone <repo>
cd genvagas
node server.mjs
```

Abra `http://localhost:3000`. O banco (`genvagas.db`) é criado automaticamente na primeira execução.

### Backup

O banco é um arquivo. Backup é cópia:

```bash
cp genvagas.db genvagas-backup.db
```

### Banco separado para desenvolvimento

Se você for mexer no código (ou deixar um agente mexer), **não rode testes no banco real**. A variável `GENVAGAS_DB` aponta para outro arquivo:

```bash
GENVAGAS_DB=./genvagas.dev.db node server.mjs
```

Quem é o banco em uso aparece no boot:

```
GenVagas em http://localhost:3000 — banco ./genvagas.db (47 vagas)
```

Duas travas protegem os dados: antes de qualquer migração que altere o schema, o banco é **copiado automaticamente** para `backups/`; e os backfills só tocam campos vazios. Se a mensagem de boot mostrar o banco errado, é sinal de que a variável não foi aplicada — pare antes de escrever.

## Funcionalidades

- **Kanban de 5 fases** com drag-and-drop nativo (arraste o card entre colunas — o status é atualizado na hora)
- **Posição escolhida por você**: ao arrastar, uma linha indica onde o card vai entrar. Solte entre dois cards e ele fica ali — não vai mais para o fim da coluna
- **Modal de nova vaga** com validação (título, empresa e data são obrigatórios)
- **Auto-move por status**: marcar uma vaga como `closed` preenche `closed_at` sozinho e move o card
- **Termômetro**: você marca a vaga como quente, morna ou fria no cadastro. Uma vaga aberta há um mês com centenas de candidatos nasce fria, mesmo cadastrada hoje. Aparece como faixa lateral colorida no card
- **Abertura da vaga**: além da data da candidatura, a data em que a vaga foi publicada. O card e o detalhe mostram o intervalo entre as duas ("aberta 10d antes") — é o insumo pra decidir se a vaga nasce quente, morna ou fria
- **Alerta de retorno automático**: cada fase tolera um tempo de silêncio (candidatado 30d, contato 14d, entrevista 7d, proposta 3d). O card mostra "há N dias" e muda de peso quando esfria — sem nenhuma data para digitar
- **Anotações em lista**: cada vaga guarda várias anotações datadas — "entrevista com a Joana", "recrutadora respondeu no WhatsApp", "segunda entrevista agendada". Cada uma é editada e excluída de forma independente, em vez de virar um texto corrido
- **Detalhe da vaga** com histórico e ações
- **API JSON** em `/vagas` pra consultar os dados de fora do app

## Modelo de dados

Duas tabelas: `jobs` (a vaga) e `job_notes` (as anotações dela).

**`jobs`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER PK | auto |
| `title` | TEXT | título da vaga (obrigatório) |
| `company` | TEXT | empresa (obrigatório) |
| `applied_at` | DATE | data da candidatura (obrigatório) |
| `opened_at` | DATE | data em que a vaga foi publicada (opcional) |
| `status` | TEXT | `candidated` \| `contacted` \| `interviewing` \| `offer` \| `closed` |
| `url` | TEXT | link da vaga |
| `source` | TEXT | `linkedin` \| `indeed` \| `empresa` \| `indicacao` \| `outro` |
| `location_type` | TEXT | `remoto` \| `hibrido` \| `presencial` |
| `status_changed_at` | DATE | último movimento de fase — base do alerta de retorno (automático) |
| `closed_at` | DATE | preenchido automaticamente ao encerrar |
| `closed_reason` | TEXT | `hired` (Contratado) \| `rejected` (Rejeitado) \| `closed_by_company` (Encerrada pela empresa) \| `frozen_by_company` (Congelada pela empresa) \| `ghosted` (Sem retorno) \| `withdrew` (Desisti) |
| `position` | REAL | ordem do card dentro da coluna (fractional indexing) |
| `heat` | TEXT | `hot` \| `warm` \| `cold` — seu julgamento sobre a chance da vaga |

**`job_notes`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER PK | auto |
| `job_id` | INTEGER | FK para `jobs.id` com `ON DELETE CASCADE` |
| `note_date` | DATE | data do que aconteceu (obrigatório) |
| `text` | TEXT | a anotação (obrigatório) |
| `created_at` | TEXT | quando foi digitada (automático) |

## Rotas

| Método | Rota | O que faz |
|--------|------|-----------|
| GET | `/` | Board kanban (HTML) |
| GET | `/vagas` | Lista em JSON |
| GET | `/vagas/:id` | Detalhe (HTML) ou JSON conforme `Accept` |
| GET | `/vagas/:id/edit` | Modal de edição |
| POST | `/vagas` | Cria vaga → redireciona 303 |
| POST | `/vagas/:id` | Edição via form HTML → redireciona 303 |
| PATCH | `/vagas/:id` | Atualiza parcialmente (merge) |
| PUT | `/vagas/:id` | Atualiza (mesma semântica do PATCH) |
| DELETE | `/vagas/:id` | Remove a vaga (e as anotações dela) |
| GET | `/vagas/:id/notes` | Anotações da vaga em JSON |
| POST | `/vagas/:id/notes` | Cria anotação (`note_date`, `text`) → 201 |
| PATCH | `/vagas/:id/notes/:nid` | Edita data ou texto da anotação |
| DELETE | `/vagas/:id/notes/:nid` | Remove a anotação → 204 |

`PATCH` faz merge com o registro existente, então o drag-and-drop manda só `{"status":"interviewing"}`.

## Estrutura

```
genvagas/
├── server.mjs          # http + roteador + shell HTML
├── db.mjs              # schema (jobs + job_notes) + prepared statements
├── views/
│   ├── board.mjs       # kanban + cards draggable
│   ├── form.mjs        # modal de nova vaga / edição
│   └── details.mjs     # detalhe da vaga + anotações
└── genvagas.db         # SQLite (criado no boot)
```

~1900 linhas no total. Cada view é uma função que recebe dados e devolve string HTML — sem engine de template, sem JSX.

## Convenções

- **Código em inglês** (`createJob`, `getJobs`), **UI em português** ("Nova vaga", "Encerrado")
- **Comentários em português**
- Sem `package.json`: o projeto depende só do runtime

## Limitações conhecidas

- **`node:sqlite` é experimental.** Emite um aviso que o app suprime no boot, e a API pode mudar entre versões do Node. É o preço de ter zero dependências.
- **Tailwind vem de CDN.** Zero dependências de npm, mas o visual depende de `cdn.tailwindcss.com` — sem internet, a página fica sem estilo. Em troca, não há passo de build.
- **Uma instância por vez.** Duas instâncias do server na mesma porta corrompem o acesso ao SQLite. Rode uma só.
- **Single-user, localhost.** Não tem autenticação, nem multiusuário — por design.
- **Migrações são self-healing, não versionadas.** O boot roda `CREATE TABLE IF NOT EXISTS` mais `ALTER TABLE` tolerantes (erro ignorado quando a coluna já existe ou já foi removida). Bancos antigos se ajustam sozinhos, sem passo manual. Quando as anotações em lista chegaram, a anotação livre antiga (`next_action`) foi convertida em nota antes de a coluna ser removida — com backup automático do banco no mesmo boot. Isso não substitui migração versionada se o schema crescer — mas para duas tabelas, elimina o passo de deploy.
- **Regras de domínio vivem na aplicação, não no schema.** Os valores de `heat` (quente/morna/fria) e `closed_reason` (os 6 desfechos) são validados em `validateJob` (server.mjs), não por `CHECK` no SQLite. Motivo: colunas adicionadas por `ALTER TABLE` não carregam constraint — a regra valeria só em banco novo e sumiria no migrado. Assim a regra é a mesma em qualquer arquivo de banco. O `closed_reason` tinha `CHECK` no schema antigo e foi removido num boot que reconstrói a tabela preservando ids e dados (`JOBS_DDL` + `hasClosedReasonCheck` em db.mjs).
  **Consequência:** `heat` e `closed_reason` são os dois dos 5 enums sem guarda no banco. Um `INSERT` direto no SQLite com valor inválido é **aceito**. Se você escrever um script de seed ou importação, ele precisa chamar `validateJob` (ou replicar `HEAT_VALUES`/`CLOSE_REASONS`) — não há rede no schema. Se isso deixar de ser garantível, o caminho é recriar a tabela com `CHECK` — e a reconstrução já tem precedente em db.mjs.

## Licença

MIT — veja [LICENSE](LICENSE).
