# Título

## 5 variantes de título para o artigo

1. **Me candidatei a tantas vagas que perdi a conta. Então tratei minha busca como um problema de organização.** — *(recomendada)* Abre pela dor reconhecível (o caos como fato, não como queixa) e fecha com a promessa do texto: organização, não um app. O leitor não precisa saber o que é kanban nem desgaste para querer ler.
2. Ninguém te avisa quando uma vaga para de andar — e é aí que a busca de emprego desanda. — Nomeia o silêncio, a parte mais dolorosa e menos discutida da busca; promete que o texto mostra como perceber.
3. A busca de emprego não desanda na entrevista. Desanda no meio do caminho, quando você não sabe mais em que pé está cada candidatura. — Localiza a dor num ponto que o leitor não estava vigiando.
4. Perdi o fio da meada de várias candidaturas ao mesmo tempo. Levei isso a sério como problema de engenharia. — Une a dor do leitor à credibilidade técnica sem mencionar o app.
5. O que eu queria era um lugar só meu para saber em que pé estava cada vaga — não mais um serviço dono dos dados da minha carreira. — Dor + princípio (soberania do dado próprio); bom se o público for mais de tecnologia.

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

- **Node.js 22+** já traz o `node:sqlite` embutido. Não precisei do `better-sqlite3`, que compila binário nativo e exige build tools na máquina de quem clona.
- **HTML renderizado no servidor** não precisa de framework. Um `http.createServer` e uma tabela de rotas resolvem as 13 rotas do app.
- **Tailwind via CDN** dá o visual sem passo de build.
- **Drag-and-drop do HTML5** é nativo. Não precisei do SortableJS.

O resultado: sem `package.json`, sem `node_modules`, sem build. `git clone` e `node server.mjs`.

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

Zero dependências não é economia de teclado, é escolha de vida útil. HTML, SQL e a biblioteca padrão não quebram. O banco é um arquivo: backup é `cp`. O app inteiro são ~2.400 linhas, duas tabelas (`jobs` e `job_notes`) e 13 rotas.

E as decisões ficaram registradas — o documento que gerou as mudanças acima tem as medições, as provas e as recomendações. Não é diário de bordo, é o registro de por que uma coisa é do jeito que é: sem ele, a discussão "o desgaste deveria olhar a data da candidatura ou o último movimento?" volta a cada seis meses.

As limitações eu também não escondo: o `node:sqlite` é experimental, o Tailwind vem de CDN (sem internet, a página fica sem estilo), e é single-user por design — roda em `localhost`, sem autenticação, porque os dados são meus.

## CTA

Não estou vendendo nada e não vou prometer que isso resolve a busca de emprego de ninguém — o que ele resolve é eu não me perder no meio dela. Se você já perdeu o fio da meada do próprio processo, me conta como organiza hoje: quero saber se a ideia do card que envelhece faz sentido para mais gente do que só para mim. E se você mexer com front, me diz o que acha do desgaste como pista visual em vez de mais um número no card.

## Hashtags

#Carreira #BuscaDeEmprego #DesenvolvimentoWeb #NodeJS #EngenhariaDeSoftware

## Sugestão de imagem / carrossel

**Formato alvo: carrossel de 5 slides** (o desgaste só existe no visual — descrever em texto perde o ponto; e o carrossel força a comparação lado a lado).

1. O board inteiro, com as 5 colunas e o arraste visível (o "antes" do problema organizado).
2. O mesmo card nos 4 estágios, lado a lado: limpo → empoeirado (7d) → encardido (14d) → fossilizado (30d), com a legenda "o card gasta com a idade da candidatura".
3. Close no rodapé de um card fossilizado: "Aplicado 11/05" + "movi há 12d" (a distinção entre idade e estagnação, que é o achado de engenharia).
4. Print do terminal: `git clone` e `node server.mjs`, sem `npm install` — a promessa de zero dependências.
5. O detalhe da vaga com a lista de anotações datadas.

Alternativa de imagem única, se preferir post só com uma arte: os 4 cards em fila horizontal, sem texto além da legenda de dias — funciona bem como miniatura no feed.

## Formato alvo e por quê

**Artigo do LinkedIn, ~800 palavras.** Dois motivos: (1) a ideia central (desgaste como pista visual, e a separação entre idade da candidatura e estagnação) só fica clara com contexto — no feed de post curto ela viraria "fiz um app bonitinho"; (2) o público é misto — recrutadores, que se interessam pelo comportamento do card, e pares de tecnologia, que se interessam pelas decisões de engenharia. O artigo comporta os dois sem virar dois textos.

## O QUE EU NÃO CONSEGUI VERIFICAR / PRECISO QUE VOCÊ CONFIRME

O que **saiu** do v2 por decisão sua (não expor contagem exata nem janela de datas):

1. **Contagem de candidaturas e período.** O v1 dizia "47 vagas" e "de 11 de maio a 17 de setembro". Fora. No lugar, o texto diz só "perdi a conta", "várias candidaturas ao mesmo tempo". Nenhuma expressão sugere quantidade maior que a real. `[CONFIRMAR: a sensação está no tom certo?]`
2. **"29 encerradas — e 20 nunca responderam nada."** Fora, era contagem pessoal. Se você quiser esse retrato no texto, ele volta em forma qualitativa ("a maioria nunca respondeu nada") — o número exato só volta se você autorizar. `[CONFIRMAR]`
3. **Zero contratações registradas.** Nunca usei; segue fora. `[CONFIRMAR: menciono ou deixo de fora?]`
4. **"3 candidaturas com data de abertura preenchida" e "4 cards desgastados hoje".** Saíram — eram contagens do seu board. O texto agora só diz que o recurso existe e que hoje quase não tem dado. `[CONFIRMAR: mantenho essa formulação?]`

Números que **permanecem** (engenharia, não volume pessoal) — confirme se ainda são exatos:

5. **13 rotas, ~2.400 linhas, duas tabelas (`jobs`, `job_notes`), 5 fases, limites de 7/14/30 dias.**
6. **Zero dependências: sem `package.json`, sem `node_modules`, sem build.** É o eixo de credibilidade do texto.
7. **`node:sqlite` é experimental / Tailwind via CDN / single-user local, sem autenticação** — é o design do README. Se em algum momento isso foi exposto na rede, o texto precisa mudar. `[CONFIRMAR: é local-only mesmo?]`

Ainda sem fonte no repositório:

8. **Tempo de desenvolvimento do app.** Não existe histórico git no projeto (`git log` falha: não é repositório). Impossível dizer sem você informar. → `[CONFIRMAR: quanto tempo levei?]`
9. **Se foi escrito com assistência de IA** (agentes/ferramentas no loop). Não aparece em nenhum arquivo do projeto e seria ângulo forte para o público de tecnologia — só se você quiser contar. → `[CONFIRMAR]`
10. **O que mais doeu.** Só consigo descrever o que está no banco. O que mais te incomodou (o silêncio, a repetição, a falta de retorno) é escolha sua. → `[CONFIRMAR: o que eu quero destacar como a dor principal?]`
11. **Nomes de empresas e títulos de vagas.** Não citei nenhuma (o banco tem os nomes reais). `[CONFIRMAR: cito alguma, ou nenhuma?]`
12. **Publicar o link do repositório.** A licença é MIT, mas o README ainda tem `git clone <repo>` como placeholder — não sei se já existe endereço público. `[CONFIRMAR: o repo é público? posso linkar?]`
