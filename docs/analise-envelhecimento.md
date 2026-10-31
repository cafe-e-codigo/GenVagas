# Análise — envelhecimento do card e abertura da vaga (Rodada 5.3)

Papel: Analista. Nenhum arquivo de app foi alterado nesta rodada (`server.mjs`, `db.mjs`, `views/*` intactos).
Data da análise: 18/09/2026 (local, 23:16) — UTC 19/09/2026 02:16. O fuso importa: ver §4.5.
Todas as provas rodaram contra cópia do banco real e instância isolada. A instância real (`:3000`, pid 1819519) e `./genvagas.db` não foram tocados.

---

## 0. Ambiente e selo

```
$ ss -ltnp | grep -E ':(3000|3925|7331)'
LISTEN 0 511 *:7331 *:* users:(("MainThread",pid=1774612,fd=23))   # mockup aprovado
LISTEN 0 511 *:3000 *:* users:(("MainThread",pid=1819519,fd=24))   # instancia REAL (nao tocada)
LISTEN 0 511 *:3925 *:* users:(("MainThread",pid=1819749,fd=24))   # demo 4 estagios

$ md5sum genvagas.db
c9ee3a01312030bd19713219378e5905  genvagas.db

$ cp genvagas.db /tmp/gv-analise.db
$ GENVAGAS_DB=/tmp/gv-analise.db PORT=3999 node server.mjs
```

`db.mjs:9` — `export const DB_PATH = process.env.GENVAGAS_DB || './genvagas.db'`: a cópia é aberta por env var, sem risco para o banco real.

Tamanho do alvo: `server.mjs` 1131 linhas · `views/board.mjs` 451 · `views/details.mjs` 427 · `views/form.mjs` 192.

---

## 1. Ponto 1 — "envelhecimento tem que ser por data de candidatura ou data de abertura"

**Veredito: hoje o desgaste mede ESTAGNAÇÃO, não IDADE. Conceitos diferentes, com usos diferentes.**

| Métrica | Campo | O que responde | O que se perde | O que se ganha |
|---|---|---|---|---|
| Estagnação (hoje) | `status_changed_at` | "há quanto tempo não mexo nesta vaga?" | mover rejuvenesce uma vaga que já nasceu velha (exatamente o que o usuário estranhou) | alerta de follow-up acionável: silêncio longo em `offer` (limite 3d) é sinal real |
| Idade da candidatura | `applied_at` | "há quanto tempo estou nesse processo?" | não distingue vaga parada de vaga que andou ontem | nunca zera ao mover; cobertura 100% |
| Idade do anúncio | `opened_at` | "há quanto tempo a vaga está publicada?" | hoje é dado inexistente em 46 de 47 linhas → desgaste invisível para quase toda a tela | é a idade "de fábrica" da vaga; independe da minha ação |

Prova de cobertura do dado (banco real copiado):

```
total 47
opened_at preenchido   1
applied_at preenchido  47
status_changed_at preenchido 47
por status [{"status":"candidated","c":18},{"status":"closed","c":28},{"status":"interviewing","c":1}]
```

Única vaga com `opened_at`: `id 97` ("Desenvolvedor(a) Fullstack Sênior", status `closed`, `opened_at=2026-05-21`, `applied_at=2026-09-15`).
O Orquestrador passou "0 de 47 com opened_at" — **refutado: é 1 de 47**. Não muda a conclusão (98% sem dado); só corrige o número.

Distribuição de desgaste que o app renderiza hoje (mesma fórmula do `agingOf`, sobre o banco real copiado):

```
{"hojeUTC":"2026-09-19","total":47,
 "porLevel":{"ok":15,"warn":3,"cold":1,"none":28},
 "cardsComDesgasteVisivel":4,"cardsSemAging":28,
 "semOpenedAt":46,"comAppliedAt":47}
```

Ou seja: **4 cards de 47 têm algum desgaste; 28 (os `closed`) nunca terão**, porque `AGING_LIMITS.closed = null` (`server.mjs:41-47`).

### Recomendação (única)

**Usar `applied_at` como data do desgaste visual e manter `status_changed_at` como alerta de follow-up — dois canais, dois significados.**

Por quê:
1. `applied_at` é `NOT NULL` no schema (`db.mjs:36`) e está preenchido em 47/47. `opened_at` é opcional e existe em 1/47: desgaste amarrado a ele nasceria invisível para 100% dos cards atuais.
2. Resolve a queixa central: mover um card **não** rejuvenesce uma vaga que já nasceu velha — o desgaste deixa de depender de movimento.
3. A estagnação continua existindo e continua útil, mas como rótulo textual ("há N dias sem movimento" / "movi hoje"), não como textura do card.

**Custo de migração se a data mudar:**

- `views/board.mjs:362` (`AGING_LIMITS`) perde sentido: limite por FASE só existe porque a métrica é estagnação. Vira uma escala única de idade (ex.: 7/14/30 dias) — decisão de produto, não de código.
- `views/board.mjs:381-393` (`agingOf(vaga)`) troca `vaga.status_changed_at` por `vaga.applied_at`; `views/details.mjs:379-392` idem (código hoje duplicado, ver §4.1).
- `server.mjs:507-514` (`agingIndex(status, days)`) precisa de um segundo insumo: o cliente não conhece data nenhuma, só `status` — é preciso expor `data-applied`/o nível calculado no card (hoje o `data-aging` já serve de cache do nível) e **parar de zerar** o desgaste no drop (`server.mjs:523`).
- O texto `'movi hoje'` (`server.mjs:530`) deixa de descrever o desgaste: ou sai, ou passa a viver em outro slot (existe `data-badge` e `data-aging-slot` já separados, `board.mjs:51,73`).
- Sem migração de banco: nenhum `UPDATE`, nenhuma coluna nova. O custo é só código + decisão de limiar.

Caminho incremental aceitável (menor): manter `status_changed_at` para o alerta e **apenas trocar a fonte do `data-aging`** para `applied_at`. Aí o desgaste para de ser apagado pelo drop e o card não rejuvenesce ao mover. `opened_at` só entra quando a cobertura justificar (hoje 2%). `ponytail:` ceiling — a escala por fase morre junto; se o usuário quiser "vaga nasceu velha" mesmo, o caminho é `opened_at ?? applied_at`, a ser reavaliado quando a cobertura passar de, digamos, metade das linhas.

---

## 2. Ponto 2 — "quando o cartão é movimentado ele não deve perder o efeito de envelhecimento"

**Veredito: confirmado, em dois casos distintos — um por design, outro por bug.**

- **Mover para OUTRA coluna** zera o relógio no servidor e o desgaste some: `server.mjs:211-213` grava `status_changed_at` = hoje quando a fase muda. Ao recarregar, o card volta ao estágio 0. É o comportamento atual por projeto — é justamente o que o usuário quer mudar (§1).
- **Reordenar DENTRO da mesma coluna** NÃO zera no servidor (`server.mjs:211` exige mudança de fase), mas o cliente pinta o card como limpo mesmo assim. Isso é o bug do §3.

A causa apontada pelo usuário ("vinculado à contagem de aberto por dias") está correta no efeito: o desgaste deriva de uma contagem de dias desde um marco que se move. Só o marco não é "aberto" — é o último movimento (`status_changed_at`).

---

## 3. Ponto 3 — "vai para 'Movi hoje' mas ao atualizar a tela perde a referência e continua a contagem"

**Veredito: confirmado e reproduzido com drag real (mouse, via CDP). O cliente mente em 2 dos 3 casos.**

Prova com drag real na instância isolada (vaga 88 preparada com `status='candidated'`, `status_changed_at='2026-08-15'` → 35 dias → estágio `cold`):

```
ANTES do drag  (board renderizado pelo servidor)
card 88 no DOM : data-aging="2" · <span data-aging-slot> = "há 35 dias"

DRAG REAL — card 88 solto DENTRO da mesma coluna (candidated), sobre o card 86
card 88 no DOM, logo apos o drop : data-aging="0" · slot = "movi hoje"     <-- CLIENTE MENTE
linha no DB depois do drop       : {"status":"candidated","status_changed_at":"2026-08-15","position":0.9999993125}
                                    (relogio NAO mudou; so a position mudou)

F5 na home
card 88 no DOM, apos reload      : data-aging="2" · slot = "há 35 dias"    <-- SERVIDOR desmente o cliente
```

Causa raiz, os dois lados da mentira:

- **Servidor** (`server.mjs:208-213`): o relógio só é reescrito quando a fase muda.
  ```js
  if (merged.status !== existing.status) {
    merged.status_changed_at = new Date().toISOString().slice(0, 10);
  }
  ```
- **Cliente** (`server.mjs:516-535`), chamado a cada drop via `moveCardInPlace` → `syncCardBadge` → `syncCardAging`:
  ```js
  card.dataset.aging = agingIndex(status, 0);   // server.mjs:523 — assume relogio zerado, sempre
  ...
  slot.textContent = 'movi hoje';               // server.mjs:530 — incondicional
  ```
  O cliente assume "todo drop = mudança de fase". É falso para reordenação.

Os 3 casos, medidos:

| Caso | O que o cliente pinta | O que persiste | Cliente mente? |
|---|---|---|---|
| Reordenar na mesma coluna (drop com `afterId`) | `data-aging=0` + "movi hoje" | `status_changed_at` intacto, só `position` muda | **SIM** |
| Drop na mesma coluna sem marcador (`afterId` ausente) | `data-aging=0` + "movi hoje" | nada muda (PATCH 200 sem efeito) | **SIM** |
| Mover para outra coluna | `data-aging=0` + "movi hoje" | `status_changed_at` = hoje | não (coerente) |

Prova do caso "sem efeito nenhum":

```
antes:  {"id":88,"status":"candidated","status_changed_at":"2026-08-15","position":0.9999993125}
PATCH {status:"candidated"} (mesma fase, SEM afterId)      -> 200 {"success":true}
depois: {"id":88,"status":"candidated","status_changed_at":"2026-08-15","position":0.9999993125}
PATCH {status:"candidated", afterId:null} (mesma fase, 1o da coluna) -> 200 {"success":true}
depois: {"id":88,"status":"candidated","status_changed_at":"2026-08-15","position":0.3124997656249999}
```

Repare: o servidor devolve **200 success** mesmo quando não persistiu nada. O cliente não tem como distinguir "movi de fase" de "reordenei" pelo status code.

Contraprova do caso legítimo (drag real `candidated` → `interviewing`, vaga 87): card no DOM ficou `data-aging="0"` + `"movi hoje"` **e** o banco confirmou `status_changed_at="2026-09-19"`. Ali o rótulo é verdadeiro.

---

## 4. Ponto 4 — bugs vizinhos (só o que tem prova)

### 4.1 `AGING_LIMITS` duplicado em 4 definições, 3 arquivos
`server.mjs:41-47` (server) · `server.mjs:496` (CLIENT_SCRIPT) · `views/board.mjs:362` · `views/details.mjs:377`.
A mesma linha literal `{ candidated: 30, contacted: 14, interviewing: 7, offer: 3, closed: null }` aparece **3 vezes** (server tem a versão multilinha). Idem `AGING_STYLES`: `server.mjs:497-503` e `views/board.mjs:372-377`. Sem teste que compare as cópias: mudar o limite em uma delas desincroniza o card do servidor sem erro nenhum.

### 4.2 Os 3 cálculos espelhados são coerentes — hoje
`server.mjs:128-141`, `views/board.mjs:381-393`, `views/details.mjs:379-392` usam a mesma fórmula (`>= limit*2` frozen, `>= limit` cold, `>= ceil(limit/2)` warn) e `server.mjs:507-514` (cliente) replica os mesmos cortes. **Não achei divergência de fórmula.** Divergem em duas coisas: o insumo (o cliente recebe `days` já calculado; `agingIndex(status, 0)` sempre 0 no drop) e o rótulo (§4.3).

### 4.3 Mesmo dado, dois rótulos
Board: `'movi hoje'` (`views/board.mjs:399`). Detalhe: `'hoje'` (`views/details.mjs:50`). Mesma métrica, texto diferente nas duas telas.

### 4.4 `data-position` é atributo morto e fica obsoleto no drop
Emitido em `views/board.mjs:52`, e **nenhum consumidor** — `grep -rn data-position` só acha essa linha no projeto. Depois de um drop o atributo continua com o valor antigo (prova acima: DOM manteve `0.9999993749999999` enquanto o banco foi para `0.9999993125`), porque `moveCardInPlace` (`server.mjs:437-465`) não o atualiza. Hoje é inofensivo; é uma armadilha para o próximo que confiar nele para ordenar.

### 4.5 Fronteira de dia em UTC
`server.mjs:212` grava `new Date().toISOString().slice(0, 10)` — **data UTC**. O fuso local é UTC-3 (`date`: local `set 18 23:16`, UTC `2026-09-19 02:16`). Consequências observadas:

```
PATCH ... -> 200   e o DB grava  status_changed_at = "2026-09-19"
                   enquanto o dia local do usuario ainda e' 2026-09-18
```

- Todo movimento feito à noite (21:00–23:59 local) grava a data de **amanhã**.
- Como o cálculo de dias (`server.mjs:135-137`, `board.mjs:388-390`) também usa "hoje UTC", o rótulo fica coerente (`days=0`), mas o "movi hoje" passa a durar mais de um dia local.
- `applied_at` vem do formulário (`views/form.mjs`, input date) = data **local** do usuário; `status_changed_at` = data **UTC**. Os dois podem discordar em um dia para lançamentos noturnos.

### 4.6 `closed` desliga o desgaste de 60% do board
`AGING_LIMITS.closed = null` → `agingOf` devolve `null` → `data-aging="0"` e nenhum badge. São 28 de 47 cards (prova em §1). Se o desgaste passar a ser idade da candidatura, decidir explicitamente se `closed` desgasta ou não (hoje: nunca).

### 4.7 `status_changed_at` aceito do corpo da requisição
O comentário diz "nunca vem do form" (`server.mjs:115`), mas `normalizeJob` faz `status_changed_at: clean(input.status_changed_at)` (`server.mjs:116`) e `handleCreate` usa `job.status_changed_at || job.applied_at` (`server.mjs:937`). Um POST com esse campo semeia o relógio. O formulário HTML não expõe o campo (`views/form.mjs` não tem `status_changed_at`), então não é alcançável pela UI — é brecha de API, não de tela. Severidade baixa, mas contradiz o contrato escrito no próprio código.

### 4.8 Página de detalhe carrega 6,2 KB de CSS de desgaste que nunca usa
`renderPage` injeta `AGING_CSS` em toda página (`server.mjs:844`), inclusive `/vagas/:id`. Medido no HTML servido:

```
bytesStyleNoHead: 6281
ocorrenciasCssDeDesgasteNoDocumento: 23
elementosDataAgingNoBody: 0
elementosDataAgingSlotNoBody: 0
```

### 4.9 O card de "Última vaga cadastrada" não desgasta
`renderLatest` (`views/board.mjs:253-280`) monta um card de destaque sem `data-aging` e sem `card-footer` de aging. É o card mais visível da home e é o único que nunca envelhece. Não é bug de cálculo — é superfície esquecida.

### 4.10 Numeração do mockup ≠ numeração do app
Mockup: `.wear-1` = limpo, `.wear-4` = fossilizado (4 classes, base 1). App: `data-aging="0"` = ok … `"3"` = frozen (base 0). O mapa é consistente (`mockup wear-2 ↔ data-aging="1"`), mas quem comparar os dois números de cabeça erra por um. Vale registrar na migração do CSS.

---

## 5. Ponto 5 — mockup aprovado vs tela de detalhe implementada

Comparação item a item: mockup `.qwen/tmp/aging-mockup/mockup.html` (linhas 458-521 = detalhe; 524-647 = card) contra o `/vagas/:id` no ar (instância isolada, `Accept: text/html`).

### 5.1 O que FOI implementado mas está invisível por falta de dado (a)

| Mockup | Implementação | Estado |
|---|---|---|
| Opção A — bloco "Tempo de anúncio": numeral grande + "dias de anúncio antes da candidatura" + "Publicada em 01/09 · candidatura em 18/09" (mockup:468-478) | `views/details.mjs:30-38`, idêntico em estrutura e hierarquia | presente, **mas só renderiza com `opened_at`** — 46 de 47 vagas não têm. Prova: `/vagas/96` (sem `opened_at`) → 0 ocorrências de "Tempo de anúncio"; `/vagas/97` (com) → `117` + "dias de anúncio antes da candidatura" + "Publicada em …". |
| Linha "Abertura: 21/05/2026 (há 117 dias até a candidatura)" (contexto do bloco) | `views/details.mjs:22-24` | idem: em 46/47 exibe "Abertura: — (informe na edição)". |

O campo é editável (`views/form.mjs:44`, `fieldDate('opened_at', 'Abertura da vaga', …)`) — o dado não existe porque não foi preenchido, não porque o recurso falte.

### 5.2 O que NÃO foi implementado (b)

| Mockup | Implementação |
|---|---|
| Opção B do detalhe — "Linha do tempo" com nó **"Vaga publicada / 01/09 / 17 d aberta até você aplicar"** como primeiro item (mockup:481-508) | A timeline existe (`views/details.mjs:137-161`) mas **sem o nó de publicação**: começa em "Candidatura enviada" (`:142`) e termina em desfecho/"Aguardando retorno" (`:158`). |
| Opção B do card — chip com moldura branca, ícone de relógio e "17 d aberta" (mockup:570-647) | Não existe no board. Foi a alternativa **não escolhida** (Opção A aprovada, comentário em `views/board.mjs:414-415`). |
| Desgaste no detalhe | O mockup **não** desenha desgaste na tela de detalhe; e o app também não (`data-aging="0"` em 0 elementos, §4.8). Aqui mockup e app concordam — não há entrega de designer pendente neste ponto. |

### 5.3 O que foi implementado DIFERENTE do mockup (c)

| Item | Mockup | App |
|---|---|---|
| Posição do intervalo de anúncio no card | Opção A: dentro do rodapé, como texto corrido — "Aplicado 18/09 · **aberta 17 d**" (mockup:547) | Linha própria **acima** do rodapé, com numeral grande: `17` + "dias abertos antes" (`views/board.mjs:416-428`) |
| Rótulo | "aberta 17 d" | "17 · dias abertos antes" |
| Timeline do detalhe | 3 nós: publicada → candidatura → aguardando | 2 nós: candidatura → desfecho/aguardando |
| Classes | `.wear-1..4` (base 1) | `data-aging="0..3"` (§4.10) |

Nenhuma dessas divergências quebra o que foi aprovado (o escolhido foi a Opção A; o app a implementa, com a variação de posição anotada). São diferenças de forma a registrar antes de mexer.

---

## 6. Resumo das recomendações

1. **Desgaste visual por `applied_at`** (idade da candidatura). Estagnação vira rótulo textual, não textura. Custo: só código, sem migração de banco (§1).
2. **Corrigir o cliente antes ou junto** (§3): o drop não pode afirmar "movi hoje" quando a fase não mudou. Mínimo: comparar `status` novo com `data-status` do card e só então zerar o desgaste; ideal: parar de derivar desgaste de movimento (§1).
3. **Unificar `AGING_LIMITS`/`AGING_STYLES`** numa fonte única servida ao cliente (hoje 4 cópias em 3 arquivos, §4.1).
4. **Decidir o relógio do `closed`** (§4.6) e o rótulo único `'movi hoje'` vs `'hoje'` (§4.3).
5. **Abertura da vaga**: o recurso está pronto e invisível; ou se faz campanha de preenchimento de `opened_at`, ou o bloco "Tempo de anúncio" fica como está (honesto: só aparece quando há dado).

---

## Apêndice — comandos-chave da prova

```bash
# copia do banco real + instancia isolada
cp /home/jose-avell/Projetos/GenVagas/genvagas.db /tmp/gv-analise.db
cd /home/jose-avell/Projetos/GenVagas && GENVAGAS_DB=/tmp/gv-analise.db PORT=3999 node server.mjs

# cobertura dos dados
node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync('/tmp/gv-analise.db'); console.log(db.prepare(\"select count(*) c from jobs where opened_at is not null and opened_at<>''\").get().c);"

# drag real (mouse, CDP) e leitura do DOM — Playwright MCP
#   1) page.locator('.card[data-id=\"88\"]').dragTo(page.locator('.card[data-id=\"86\"]'))
#   2) page.evaluate(() => { const c=document.querySelector('.card[data-id=\"88\"]'); return { aging:c.dataset.aging, slot:c.querySelector('[data-aging-slot]').textContent }; })
#   depois: page.reload() e repetir a leitura

# o no-op que o cliente disfarca de movimento
curl -s -X PATCH http://127.0.0.1:3999/vagas/88 -H 'Content-Type: application/json' -d '{"status":"candidated"}'
node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync('/tmp/gv-analise.db'); console.log(db.prepare('select status,status_changed_at,position from jobs where id=88').get());"

# detalhe: recurso presente mas invisivel / CSS morto
curl -s -H 'Accept: text/html' http://127.0.0.1:3999/vagas/97 | grep -c 'Tempo de an'
curl -s -H 'Accept: text/html' http://127.0.0.1:3999/vagas/96 | grep -c 'Tempo de an'
```
