# Artigo final — LinkedIn

## Título

## 3 variantes de título

1. **Me candidatei a tantas vagas que perdi a conta. Então tratei minha busca como um problema de organização.** — *(recomendada)* Abre pela dor reconhecível (o caos como fato, não como queixa) e fecha com a promessa do texto: organização, não um app. O leitor não precisa saber o que é kanban nem desgaste para querer ler.
2. Ninguém te avisa quando uma vaga para de andar — e é aí que a busca de emprego desanda. — Nomeia o silêncio, a parte mais dolorosa e menos discutida da busca.
3. O que eu queria era um lugar só meu para saber em que pé estava cada vaga — não mais um serviço dono dos dados da minha carreira. — Dor + princípio (soberania do próprio dado); bom se o público for mais de tecnologia.

## Variantes de gancho (primeira linha)

1. *(escolhida)* Em algum ponto, eu já não sabia mais para quem eu tinha mandado o currículo.
2. Perdi a conta das vagas que eu estava perseguindo ao mesmo tempo — e o que me afundou não foi a rejeição.
3. Se alguém me perguntasse "como está a busca?", eu não conseguia responder sem reconstruir tudo de cabeça.

---

## Corpo

Em algum ponto, eu já não sabia mais para quem eu tinha mandado o currículo.

Procurar emprego parece um processo linear: você se candidata, espera, alguém responde. Na prática é um monte de processos acontecendo ao mesmo tempo, cada um num ritmo, e nenhum deles avisa quando parou de andar. Depois de algumas semanas, responder "como está a busca?" exige reconstruir de cabeça o que aconteceu com cada vaga.

O problema nunca foi me candidatar. Foi acompanhar. Quem respondeu, quem nunca vai responder, com quem eu já falei, qual eu já descartei, em qual eu deveria insistir. Eu queria um lugar só meu para isso — não um serviço de terceiros dono dos dados da minha carreira.

Então escrevi o GenVagas. A decisão que definiu todo o resto foi uma pergunta: **quanto de stack eu realmente preciso?** A resposta foi quase nada.

- **Node.js 22+** já traz o `node:sqlite` embutido. Não precisei do `better-sqlite3`, que compila binário nativo e exige build tools na máquina de quem roda.
- **HTML renderizado no servidor** não precisa de framework. Um `http.createServer` e uma tabela de rotas resolvem as 13 rotas do app.
- **Tailwind via CDN** dá o visual sem passo de build.
- **Drag-and-drop do HTML5** é nativo. Não precisei do SortableJS.

O resultado: sem `package.json`, sem `node_modules`, sem build. Baixar a pasta e rodar `node server.mjs`.

### O que o app faz

São cinco fases — candidatado, contato feito, entrevistando, proposta, encerrado — e eu arrasto o card entre elas. A posição é escolhida por mim: ao arrastar, uma linha mostra onde o card vai entrar, e ele fica exatamente ali, em vez de cair no fim da coluna.

Cada vaga guarda anotações em lista, cada uma com a sua data, editadas e excluídas de forma independente: "entrevista com a recrutadora", "respondeu no WhatsApp", "segunda entrevista agendada". Vira um histórico datado, não um parágrafo que eu preciso reler inteiro para achar uma informação.

Tem busca instantânea no board (filtra os cards das colunas, não as fases), um termômetro para eu marcar se a vaga está quente, morna ou fria, e uma coluna que rola por dentro, no estilo Trello, para a página não crescer junto com a lista.

### A ideia de que eu mais gosto: o card envelhece

Este é o motivo de eu ter escrito o post.

O card não é uma etiqueta estática. Ele **gasta** conforme a candidatura envelhece. Até 6 dias, papel limpo. A partir de **7 dias** ele começa a empoeirar: leve rotação, um amarelado discreto, fuligem nas bordas. A partir de **14**, fica encardido — mais mancha, mais sujeira, mais peso. A partir de **30**, está fossilizado, com deriva lenta da própria textura.

O detalhe de que eu mais gosto é que o desgaste **não usa cor nenhuma**. A cor do card já pertence ao termômetro — quente, morna, fria —, que é o meu julgamento sobre a chance da vaga. Se o desgaste também pintasse o card, vermelho ia significar "quente" e "atrasado" ao mesmo tempo e as duas escalas brigariam. Então o envelhecimento fala por textura, luz, geometria e movimento. O alerta de silêncio vira peso de fonte. Duas escalas, dois canais.

E ele é honesto nos limites: vaga encerrada não desgasta, mas o rodapé continua mostrando a idade real da candidatura. Nada de mentir no card.

### Mover o card rejuvenesce a vaga? Não devia

Aqui o app me corrigiu, e vale contar porque foi medido, não achado.

Na primeira versão, o desgaste media o tempo desde o **último movimento** do card. Parece razoável, até você perceber o efeito colateral: arrastar um card para outra coluna zerava o relógio e apagava toda a poeira. Uma vaga que nasceu velha — anúncio aberto há um mês, com uma fila de candidatos na minha frente — ficava com cara de nova porque eu mexi nela hoje.

Levantei a questão com uma cópia do banco e uma instância isolada, medindo o que o navegador mostrava antes e depois do arraste, com mouse de verdade, e comparando com o que ficou gravado no banco. O resultado: o card afirmava "movi hoje" enquanto o banco não tinha mudado nada. Mover **não** deveria apagar o desgaste.

Hoje existem duas métricas, com papéis distintos e nomes que deixam isso óbvio:

- **Desgaste** (textura) = idade da candidatura, em escala única: 7, 14 e 30 dias. Nunca rejuvenesce.
- **Estagnação** (rótulo textual de follow-up) = silêncio desde o último movimento, com limite por fase: 30 dias num "candidatado" é normal, 3 dias numa "proposta" já é péssimo sinal.

Mover o card agora muda a fase e o rótulo de movimento. Só isso. A poeira fica.

### O que eu aprendi tratando isso como projeto de verdade

Zero dependências não é economia de teclado, é escolha de vida útil. HTML, SQL e a biblioteca padrão não quebram. O banco é um arquivo: backup é `cp`. O app inteiro são 2.630 linhas, duas tabelas (`jobs` e `job_notes`) e 13 rotas.

E as decisões ficaram registradas — o documento que gerou as mudanças acima tem as medições, as provas e as recomendações. Não é diário de bordo, é o registro de por que uma coisa é do jeito que é: sem ele, a discussão "o desgaste deveria olhar a data da candidatura ou o último movimento?" volta a cada seis meses.

As limitações eu também não escondo: o `node:sqlite` é experimental, o Tailwind vem de CDN (sem internet, a página fica sem estilo), e é single-user por design — roda local, sem autenticação, porque os dados são meus.

## CTA

Não estou vendendo nada e não vou prometer que isso resolve a busca de emprego de ninguém — o que ele resolve é eu não me perder no meio dela. Se você já perdeu o fio da meada do próprio processo, me conta como organiza hoje: quero saber se a ideia do card que envelhece faz sentido para mais gente do que só para mim. E se você mexer com front, me diz o que acha do desgaste como pista visual em vez de mais um número no card.

## Hashtags

#Carreira #BuscaDeEmprego #DesenvolvimentoWeb #NodeJS #EngenhariaDeSoftware

## Sugestão de imagem / carrossel

**Formato alvo: carrossel de 5 slides** (o desgaste só existe no visual — descrever em texto perde o ponto; e o carrossel força a comparação lado a lado).

1. O board inteiro, com as 5 colunas e o arraste visível (o "antes" do problema organizado).
2. O mesmo card nos 4 estágios, lado a lado: limpo → empoeirado (7d) → encardido (14d) → fossilizado (30d), com a legenda "o card gasta com a idade da candidatura".
3. Close no rodapé de um card fossilizado: "Aplicado 11/05" + "movi há 12d" (a distinção entre idade e estagnação, que é o achado de engenharia).
4. Print do terminal: `node server.mjs` — sem `npm install`, sem build. A promessa de zero dependências.
5. O detalhe da vaga com a lista de anotações datadas.

Alternativa de imagem única, se preferir post só com uma arte: os 4 cards em fila horizontal, sem texto além da legenda de dias — funciona bem como miniatura no feed.

## Formato alvo e por quê

**Artigo do LinkedIn, ~800 palavras.** Dois motivos: (1) a ideia central (desgaste como pista visual, e a separação entre idade da candidatura e estagnação) só fica clara com contexto — no feed de post curto ela viraria "fiz um app bonitinho"; (2) o público é misto — recrutadores, que se interessam pelo comportamento do card, e pares de tecnologia, que se interessam pelas decisões de engenharia. O artigo comporta os dois sem virar dois textos.

## Observações de produção (não vão para o artigo)

- **Sem link de repositório.** O projeto não é repositório git; não existe URL pública. O texto não afirma que o código está aberto. Onde o v2 dizia `git clone`, agora está "baixar a pasta e rodar `node server.mjs`".
- **Números travados por medição (21/09/2026):** 13 rotas (`server.mjs:1142–1154`), 2.630 linhas, 5 fases, 2 tabelas (`jobs`, `job_notes` — `db.mjs:33,97`), zero dependências. Limites de desgaste 7/14/30 (`views/board.mjs:434`) e de estagnação 30/14/7/3 (`views/board.mjs:439`), conferidos no código.
- **Local:** `server.listen(PORT)` sem host explícito — o texto diz "roda local, sem autenticação", sem jurar `localhost`.
- **Omitidos por decisão do dono:** tempo de desenvolvimento, apoio de IA, citação de empresa/vaga/recrutador. Também fora: contagem exata de candidaturas, "zero contratações" e o retrato "a maioria nunca respondeu".
- **Não mencionar** import/Gupy (comentário órfão em `views/board.mjs`, `details.mjs` e `form.mjs`, sem rota ou script de import no projeto).
- **Pendência aberta (item 1 do dono):** o tom da quantidade sem número, mantido qualitativo.
