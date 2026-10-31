# Post para o feed do LinkedIn

## Título (usado só se a plataforma pedir / para referência interna)

1. **Achei que o problema era a rejeição. Era não saber mais em que pé estava cada candidatura.** — *(recomendada)* O leitor reconhece o próprio sintoma antes de saber que existe um app: rejeição é esperada, a bagunça é o que dói.
2. Me candidatei a tantas vagas que perdi a conta — e o que me afundou não foi a rejeição. — Mesmo reconhecimento, com a virada explícita no meio da frase.
3. Ninguém te avisa quando uma vaga para de andar. Você só descobre tarde demais. — Fala do silêncio, que é a dor mais específica da busca; promete que o texto mostra como perceber.
4. Se você já não sabe mais para quem mandou o currículo, este post é pra você. — Chamada direta por identificação; risco de soar genérico, funciona melhor como primeira linha do que como título.
5. A busca de emprego não é difícil pelas entrevistas. É difícil no meio do caminho, quando nada está organizado. — Nomeia a dor que quase ninguém nomeia, sem falar de recurso nenhum.

## Variantes de gancho (primeira linha — o que aparece antes do "ver mais")

1. *(escolhida)* Em algum ponto eu já não sabia mais para quem eu tinha mandado o currículo — nem qual processo tinha parado de andar em silêncio.
2. Perdi a conta das vagas que eu perseguia. E o pior não era a rejeição: era não saber mais em que pé estava cada processo.
3. Me candidatei a vagas demais para acompanhar de cabeça. Foi quando parar de tentar organizar virou o problema.

---

## Corpo

Em algum ponto eu já não sabia mais para quem eu tinha mandado o currículo — nem qual processo tinha parado de andar em silêncio.

Procurar emprego parece linear: você se candidata, espera, alguém responde. Na prática é um monte de processos acontecendo ao mesmo tempo, cada um num ritmo, e nenhum avisa quando parou de andar. Depois de alguns meses, a pergunta "como está a busca?" não tem resposta curta.

O que me travou não foi a rejeição. Foi o emaranhado: perdi a conta de quantas candidaturas estavam em aberto, quais eu já tinha descartado e em qual eu ainda deveria insistir.

Escrevi o **GenVagas** para resolver isso. É um kanban de 5 fases onde eu arrasto o card e a fase muda.

Mas a parte de que eu mais gosto é outra: **o card envelhece.**

- até 6 dias: papel limpo
- a partir de **7 dias**: começa a empoeirar
- a partir de **14**: encardido
- a partir de **30**: fossilizado, com deriva lenta da própria textura

O desgaste não usa cor nenhuma. A cor do card pertence ao termômetro — quente, morna, fria —, que é o meu julgamento sobre a chance da vaga. Se o desgaste também pintasse o card, vermelho ia significar "quente" e "atrasado" ao mesmo tempo. Então ele fala por textura, luz e geometria.

E arrastar o card não rejuvenesce a vaga: a poeira fica. Foi a correção mais útil que o app me obrigou a fazer, decidida com medição — o documento da análise está no projeto.

O de baixo é engenharia, mas interessa a quem já sofreu com dependência quebrada: **zero dependências.** Sem `package.json`, sem `node_modules`, sem build. Node.js puro com SQLite embutido, HTML renderizado no servidor, drag-and-drop nativo. São ~2.400 linhas e 13 rotas. `git clone` e `node server.mjs` — só isso.

Não estou vendendo nada, nem vou dizer que isso resolve a busca de emprego de alguém. O que ele resolve é eu não me perder no meio dela.

Se você já perdeu o fio da meada do seu próprio processo: como você organiza hoje? Me conta nos comentários — quero saber se a ideia do card que envelhece faz sentido para mais gente. E se você mexe com front, me diz o que acha do desgaste como pista visual em vez de mais um número no card.

## Hashtags

#Carreira #BuscaDeEmprego #DesenvolvimentoWeb #NodeJS #EngenhariaDeSoftware

## Sugestão de imagem / carrossel

**Imagem única, forte:** os 4 estágios do mesmo card lado a lado (limpo → empoeirado → encardido → fossilizado), com a legenda de dias embaixo de cada um (0 · 7 · 14 · 30). Vira uma imagem que se entende no tamanho de miniatura do feed.

**Se preferir carrossel (3 slides):** (1) o board com as 5 colunas; (2) os 4 estágios lado a lado; (3) o rodapé de um card fossilizado mostrando "Aplicado 11/05" e "movi há 12d" — a diferença entre a idade da candidatura e o silêncio desde o último movimento.

## Formato alvo e por quê

**Post curto para o feed (~250 palavras).** É o formato certo por dois motivos: a imagem já carrega sozinha a ideia do desgaste (o post só precisa nomeá-la), e o texto curto é o que dá a primeira hora de conversa nos comentários — que é onde o alcance acontece. O artigo longo entra depois, como continuação para quem quiser as decisões de engenharia.

## O QUE EU NÃO CONSEGUI VERIFICAR / PRECISO QUE VOCÊ CONFIRME

O que **saiu** deste v2 por decisão sua (não quero mais expor contagem exata nem janela de datas):

1. **Toda a contagem de candidaturas** — o v1 dizia "47 vagas" e "registradas de 11 de maio a 17 de setembro". Agora o texto fala em sensação: "perdi a conta", "vagas demais para acompanhar de cabeça". Nada no lugar sugere quantidade maior que a real. `[CONFIRMAR: a sensação está no tom certo, ou ainda soa exagerado?]`
2. **Quantos processos ficaram sem resposta** — o v1 não usou no post, e eu também não usei. Fora do post por design.
3. **Tempo de desenvolvimento** — não há histórico git no projeto, não dá para datar o trabalho. `[CONFIRMAR: quanto tempo levei?]`
4. **Se posso dizer que escrevi com apoio de agentes de IA** — não aparece em nenhum arquivo do projeto. `[CONFIRMAR]`
5. **Pode citar empresa, vaga ou nome de recrutador?** Não citei nenhum. `[CONFIRMAR: nenhum, presumo?]`
6. **O repositório é público?** A licença é MIT, mas o README ainda tem `git clone <repo>` como placeholder — se não houver endereço público, o post fica sem link (e eu não coloquei nenhum). `[CONFIRMAR: posso dizer "o código está aberto"?]`
7. **Números de engenharia: 13 rotas, ~2.400 linhas, 5 fases, 2 tabelas** — esses eu mantive porque são os que dão credibilidade, não os da sua busca. `[CONFIRMAR: ainda são os valores exatos hoje?]`
8. **Desgaste pela idade da candidatura, não pelo último movimento** — mantive a afirmação porque ela é o achado central do texto e tem documento no projeto. `[CONFIRMAR: nenhuma mudança depois que eu escrevi?]`
