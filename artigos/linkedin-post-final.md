# Post final — feed do LinkedIn

## Título (referência interna; a plataforma não pede título em post de feed)

1. **Achei que o problema era a rejeição. Era não saber mais em que pé estava cada candidatura.** — *(recomendada)* O leitor reconhece o próprio sintoma antes de saber que existe um app: rejeição é esperada, a bagunça é o que dói.
2. Ninguém te avisa quando uma vaga para de andar. Você só descobre tarde demais. — Fala do silêncio, a dor mais específica da busca.
3. A busca de emprego não é difícil pelas entrevistas. É difícil no meio do caminho, quando nada está organizado. — Nomeia a dor que quase ninguém nomeia, sem falar de recurso nenhum.

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

E arrastar o card não rejuvenesce a vaga: a poeira fica. Foi a correção mais útil que o app me obrigou a fazer, e ela saiu de medição, não de achismo.

O de baixo é engenharia, mas interessa a quem já sofreu com dependência quebrada: **zero dependências.** Sem `package.json`, sem `node_modules`, sem build. Node.js puro com SQLite embutido, HTML renderizado no servidor, drag-and-drop nativo. São 2.630 linhas e 13 rotas. Baixar a pasta e rodar `node server.mjs` — só isso.

Não estou vendendo nada, nem vou dizer que isso resolve a busca de emprego de alguém. O que ele resolve é eu não me perder no meio dela.

Se você já perdeu o fio da meada do seu próprio processo: como você organiza hoje? Me conta nos comentários — quero saber se a ideia do card que envelhece faz sentido para mais gente. E se você mexe com front, me diz o que acha do desgaste como pista visual em vez de mais um número no card.

## Hashtags

#Carreira #BuscaDeEmprego #DesenvolvimentoWeb #NodeJS #EngenhariaDeSoftware

## Sugestão de imagem / carrossel

**Imagem única, forte:** os 4 estágios do mesmo card lado a lado (limpo → empoeirado → encardido → fossilizado), com a legenda de dias embaixo de cada um (0 · 7 · 14 · 30). Entende-se no tamanho de miniatura do feed.

**Se preferir carrossel (3 slides):** (1) o board com as 5 colunas; (2) os 4 estágios lado a lado; (3) o rodapé de um card fossilizado mostrando "Aplicado 11/05" e "movi há 12d" — a diferença entre a idade da candidatura e o silêncio desde o último movimento.

## Formato alvo e por quê

**Post curto para o feed (~250 palavras).** A imagem carrega sozinha a ideia do desgaste (o post só precisa nomeá-la), e o texto curto é o que dá a primeira hora de conversa nos comentários — onde o alcance acontece. O artigo longo entra depois, no primeiro comentário, como continuação para quem quiser as decisões de engenharia.

## Observações de produção (não vão para o post)

- **Sem link.** O projeto não é repositório git; não existe URL pública. Não afirmar "código aberto". O artigo, se publicado, vai como link no **primeiro comentário**, nunca no corpo.
- **Pendência aberta (item 1 do dono):** o tom da quantidade segue qualitativo ("perdi a conta", "vagas demais para acompanhar de cabeça"). Se o dono quiser corrigir o tom, é ajuste de uma linha.
- **Omitidos por decisão do dono:** tempo de desenvolvimento, apoio de IA, citação de empresa/vaga/recrutador.
- **Não mencionar** import/Gupy (comentário órfão no código, sem rota ou script).
