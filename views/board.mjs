/**
 * RenderBoard — Kanban board com 5 colunas (candidated, contacted, interviewing, offer, closed)
 * Cards draggable (HTML5) com PATCH /vagas/:id { status } no drop
 * @param {Array} vagas — array de vagas do DB
 * @returns {string} HTML string
 */
import { todayLocalISO } from '../dates.mjs';

export function renderBoard(vagas) {
  const columns = [
    { key: 'candidated', label: 'Candidatado', color: 'bg-slate-400' },
    { key: 'contacted', label: 'Contato feito', color: 'bg-indigo-300' },
    { key: 'interviewing', label: 'Entrevistando', color: 'bg-indigo-500' },
    { key: 'offer', label: 'Proposta', color: 'bg-indigo-600' },
    { key: 'closed', label: 'Encerrado', color: 'bg-slate-700' }
  ];

  const groupByStatus = (vagas) => {
    return columns.reduce((acc, col) => {
      acc[col.key] = vagas.filter(v => v.status === col.key);
      return acc;
    }, {});
  };

  const grouped = groupByStatus(vagas);

  const renderCard = (vaga) => {
    const isClosed = vaga.status === 'closed';
    const closedReasonBadge = isClosed ? getClosedReasonBadge(vaga.closed_reason) : '';
    const sourceLabel = vaga.source ? `<span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">${capitalize(vaga.source)}</span>` : '';
    const locationLabel = vaga.location_type ? `<span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">${capitalize(vaga.location_type)}</span>` : '';
    const heatBadge = renderHeat(vaga);
    const agingBadge = renderAging(vaga);
    const openedRow = renderOpenedGap(vaga);
    const appliedAt = formatDateBR(vaga.applied_at);
    // Faixa lateral: a cor e' o canal mais caro do card, entao ela pertence ao
    // termometro (julgamento do usuario), nao ao aging. Este ja foi uma escala de
    // cor e agora usa peso de fonte — antes as duas escalas competiam e o
    // vermelho significava "quente" e "atrasado" ao mesmo tempo.
    const heatStrip = HEAT_STRIPS[vaga.heat] || 'bg-slate-200';
    const isHot = vaga.heat === 'hot';
    const a = agingOf(vaga);

    return `
      <div class="card relative overflow-hidden rounded-xl border ${isHot ? 'border-orange-300' : 'border-slate-200'} ${isHot ? 'bg-orange-50/40' : 'bg-white'} shadow-sm hover:border-indigo-300 hover:shadow transition-all"
           draggable="true"
           ondragstart="drag(event)"
           ondragend="endDrag()"
           data-id="${vaga.id}"
           data-status="${vaga.status}"
           data-heat="${vaga.heat || ''}"
           data-search="${escapeHtml((vaga.title + ' ' + vaga.company).toLowerCase())}"
           data-aging="${a ? AGING_LEVEL_NUM[a.level] : 0}">
        <span class="pointer-events-none absolute inset-y-0 left-0 w-1 ${heatStrip}" data-heat-strip="1" aria-hidden="true"></span>
        <a href="/vagas/${vaga.id}" draggable="false" class="block p-4 cursor-move">
          <!-- break-words nos dois: e' a RAIZ da barra horizontal dentro da
               coluna. Palavra sem ponto de quebra ("ANALISTA/DESENVOLVEDOR",
               "DesenvolvedorFullstack...") estica a caixa em vez de quebrar e,
               com o line-clamp-2 prendendo a 2 linhas, o resto sai CORTADO —
               medido: 344px de texto escondidos. Quebrando, a palavra ocupa a 2a
               linha (ou a terceira, cortada pelo clamp, que e' de longitud) e
               nada e' clipado. -->
          <p class="break-words text-xs font-semibold uppercase tracking-wider text-indigo-600">${escapeHtml(vaga.company)}</p>
          <h3 class="mt-1 line-clamp-2 break-words font-semibold leading-snug text-slate-900" title="${escapeHtml(vaga.title)}">${escapeHtml(vaga.title)}</h3>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${heatBadge}
            ${sourceLabel}
            ${locationLabel}
          </div>
          <!-- Dois slots distintos de proposito: o badge e' o desfecho (so em
               Encerrado) e o rotulo de movimento e' derivado do ultimo
               status_changed_at. Antes os dois dividiam o mesmo <span>, e mover
               um card apagava a data do outro. O DESGASTE nao mora aqui: ele e'
               a textura do .card via data-aging (idade da candidatura). -->
          <div class="card-footer mt-3 border-t border-slate-100 pt-3">
            ${openedRow}
            <!-- flex-wrap + min-w-0: em coluna estreita (186px em 1024)
                 "Aplicado" + rotulo de movimento + desfecho nao cabem na mesma
                 linha — medido, 16px de estouro que o overflow-hidden clipava.
                 O wrap na linha resolve o caso comum; e o grupo da direita
                 TAMBEM precisa poder quebrar por dentro (flex-wrap + min-w-0,
                 sem shrink-0), senao ele sozinho, com desfecho + movimento
                 juntos, ja fica mais largo que a coluna e o wrap nao tem para
                 onde empurrar. -->
            <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span class="min-w-0 truncate text-xs text-slate-500">Aplicado ${appliedAt}</span>
              <span class="flex min-w-0 flex-wrap items-center gap-1.5">
                <!-- Marcador do slot (nao e' o nivel): o nivel vive no .card como
                     data-aging. Antes os dois usavam o mesmo atributo e contar
                     estagios no HTML dava numero errado. -->
                <span data-aging-slot="1">${agingBadge}</span>
                <span data-badge="1">${closedReasonBadge}</span>
              </span>
            </div>
          </div>
        </a>
      </div>
    `;
  };

  const renderColumn = (col) => {
    const columnVagas = grouped[col.key] || [];
    const count = columnVagas.length;

    return `
      <!-- Coluna que rola por dentro (padrao Trello, rodada 7): a pagina nao
           cresce junto com os cards. O teto e' MEDIDO, nao chutado, com Chrome
           headless na replica do shell. Rodada 10 apertou as margens acima da
           faixa, entao o topo dela desceu de y = 323 para y = 295 (a 40px de
           folga que sobrou virou altura de coluna).
           lg e acima (>=1024): 295 + stripPad 4 + mainPad 32 = 331, e sem os
           15px da barra HORIZONTAL — de lg pra cima as 5 colunas dividem a faixa
           em 1fr e nao ha o que rolar.
           De 640 a 1023: a faixa rola de novo (piso de 240px), a barra volta e o
           total e' 346. Abaixo de 640: 370 (a linha da busca empurra 24px a mais
           quando o titulo trunca).
           Sem piso artificial de altura: em CSS min-height vence max-height,
           entao um floor fixo aqui reintroduzia o scroll da pagina num viewport
           baixo. A presenca da coluna vazia vem do placeholder (min-h-[200px]) e
           do stretch do grid. O min-h-0 vai na coluna, no wrapper interno e no
           dropzone: sao os itens flex que precisam poder encolher para o
           overflow-y-auto ativar. -->
      <div class="column flex flex-col min-h-0 max-h-[calc(100vh_-_370px)] sm:max-h-[calc(100vh_-_346px)] lg:max-h-[calc(100vh_-_331px)]" data-status="${col.key}">
        <div class="flex flex-1 min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
          <!-- Cabecalho (bolinha + nome + contador) fica FORA do container que
               rola: e' o unico jeito de o contador acompanhar o scroll. -->
          <div class="mb-3 flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full ${col.color}"></span>
              <h2 class="text-sm font-semibold text-slate-700">${col.label}</h2>
            </div>
            <span class="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200" id="count-${col.key}">${count}</span>
          </div>
          <!-- relative: ancora o marcador de insercao, que e' absolute de proposito
               (no fluxo normal ele empurraria os cards e a linha tremia).
               min-w-0: e' item flex do wrapper e o minimo automatico dele e' o
               min-content do conteudo — sem isso o card mais largo ESTICA o
               dropzone em vez de ser contido.
               overflow-x-hidden e' cinto, nao conserto: por regra do CSS
               overflow-y-auto promove o eixo X para auto, e a largura da coluna e'
               fracionaria (1fr), entao 1px de arredondamento ja desenha a barra
               mesmo com o conteudo correto (medido: client 228 / scroll 229).
               O conserto de verdade sao o min-w-0 daqui e o break-words do card.
               A legenda de desfechos entra AQUI dentro porque e' conteudo da
               lista, nao cabecalho — rola junto com os cards. -->
          <div class="dropzone relative min-w-0 flex-1 min-h-0 space-y-3 overflow-x-hidden overflow-y-auto rounded-lg" ondragover="dragOverCard(event, this)" ondragleave="dragLeaveZone(event, this)" ondrop="drop(event, '${col.key}')">
            ${col.key === 'closed' ? renderClosedReasonsLegend() : ''}
            ${columnVagas.map(renderCard).join('')}
            ${renderEmptyPlaceholder(count > 0)}
          </div>
        </div>
      </div>
    `;
  };

  return `
    <section>
      <p class="text-sm font-semibold uppercase tracking-wider text-indigo-600">Pipeline</p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900">Vagas por fase</h1>
      <p class="mt-2 max-w-2xl text-slate-600">
        Arraste os cards entre colunas para mover de fase. O status é atualizado automaticamente.
      </p>

      <!-- Opcao A aprovada: busca e ultima vaga dividem UMA faixa. O box de
           160px + o mt-8 dele custavam 192px antes do board.
           A ultima vaga leva um anel indigo + fundo tingido: e' o dado que o
           usuario quer ver ao chegar na tela. Peso MENOR que o "Nova vaga" do
           header de proposito — o CTA e' solido (bg-indigo-600 + texto branco),
           o destaque e' contorno fino + texto em slate; sem preenchimento e sem
           sombra, nao compete. E nao cresce a linha: o box tem ~36px dentro dos
           38px do input.
           O input nao encolhe alem de 280px e o resto trunca — o que nao cabe na
           linha (termometro, fonte, local, data) nao some: vive no title do item.
           A busca filtra os cards DAS COLUNAS (nao e' filtro por fase) e o termo
           sobrevive ao reload (sessionStorage) porque mover um card que nao move
           in-place recarrega a pagina. -->
      <div class="mt-5 flex items-center gap-3">
        <label for="board-search" class="sr-only">Buscar vagas</label>
        <input id="board-search" type="search" placeholder="Buscar por vaga ou empresa…" autocomplete="off"
               class="block w-full max-w-[280px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
        ${renderLatestRow(vagas)}
      </div>

      <!-- Nenhum resultado: renderizado no server e so' alternado pelo script.
           Existe para que a busca sem match nao pareca board quebrado. -->
      <div id="board-no-results" class="mt-4 hidden rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p class="text-sm font-medium text-slate-600">Nenhuma vaga corresponde à busca.</p>
        <p class="mt-1 text-xs text-slate-400">Ajuste o termo ou limpe o campo para ver todas.</p>
      </div>

      <!-- Faixa de colunas. Duas decisoes de rodada 10:
           (1) PISO 240px AGORA SO ATE lg (1024). De lg pra cima as 5 colunas
               dividem a faixa em 1fr (auto-cols-fr = minmax(0,1fr)) e NAO rolam:
               medido, a coluna vale (largura - 96) / 5 — o 96 soma o respiro
               interno da faixa (2 x 16 depois do ajuste b) e os 4 gaps de 16px.
               1024 -> 185.6px, 1152 -> 211px, 1280 -> 237px, 1440 -> 269px,
               1920 -> 365px. 186px e o minimo praticavel: texto do card fica com
               ~130px (o chip "Contato feito" de ~80px cabe, o titulo tem
               line-clamp-2 e o nome completo vive no title + detalhe). Abaixo de
               lg o tamanho cai para o patamar de tablet (768 -> 134px), e ai o
               encolhimento deixa de ser aceitavel: o piso de 240px volta e a
               faixa rola. overflow-x-auto fica como guarda — sem overflow ele e'
               inerte.
           (2) O respiro interno da faixa cai de 40px para 16px de cada lado
               (px-4), o board fica mais perto das bordas e as colunas ganham
               ~10px cada. O -mx continua cancelando EXATAMENTE o padding do
               <main> (px-6 / lg:px-10) — se divergirem, o kanban desalinha. -->
      <div class="mt-4 -mx-6 grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto px-4 pb-1 lg:-mx-10 lg:px-4 lg:auto-cols-fr">
        ${columns.map(renderColumn).join('')}
      </div>

      <script>
        (function () {
          var STORAGE_KEY = 'gv:board-search';
          var input = document.getElementById('board-search');
          var noResults = document.getElementById('board-no-results');
          if (!input) return;

          // sessionStorage e' o canal combinado para sobreviver ao reload do drag.
          // Em modo privado ele pode lancar: o filtro segue valendo na sessao atual.
          function readStored() {
            try { return sessionStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
          }
          function writeStored(term) {
            try {
              if (term) sessionStorage.setItem(STORAGE_KEY, term);
              else sessionStorage.removeItem(STORAGE_KEY);
            } catch (e) {}
          }

          function visibleCards(zone) {
            return [].slice.call(zone.querySelectorAll('.card')).filter(function (c) {
              return !c.classList.contains('hidden');
            });
          }

          // Filtro: substring case-insensitive sobre titulo+empresa (data-search).
          // Cards NUNCA saem do DOM — o drag e o marcador de insercao dependem dos
          // nos — so' recebem/perdem 'hidden'. Contador e placeholder sao derivados
          // do que esta visivel.
          function applyFilter() {
            var term = input.value.trim().toLowerCase();
            document.querySelectorAll('.column').forEach(function (col) {
              col.querySelectorAll('.card').forEach(function (card) {
                var hay = card.dataset.search || '';
                card.classList.toggle('hidden', term !== '' && hay.indexOf(term) === -1);
              });
              var visible = visibleCards(col).length;
              var out = document.getElementById('count-' + col.dataset.status);
              if (out) out.textContent = String(visible);
              syncColumnEmpty(col, visible);
            });
            updateNoResults(term);
          }

          // O placeholder vem do server sempre; aqui so' alternamos 'hidden'. Se
          // faltar (coluna sem card nenhum criada em runtime), recriamos com a
          // MESMA classe do HTML inicial — classe nova escaparia do JIT do Tailwind.
          function syncColumnEmpty(col, visibleCount) {
            var zone = col.querySelector('.dropzone');
            if (!zone) return;
            var ph = zone.querySelector('[data-placeholder]');
            if (visibleCount > 0) {
              if (ph) ph.classList.add('hidden');
              return;
            }
            if (!ph) {
              zone.insertAdjacentHTML('beforeend',
                '<div data-placeholder="1" class="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 p-6"><p class="text-xs text-slate-400">Nada por aqui</p></div>');
              ph = zone.querySelector('[data-placeholder]');
            }
            if (ph) ph.classList.remove('hidden');
          }

          function updateNoResults(term) {
            if (!noResults) return;
            var total = 0;
            document.querySelectorAll('.column .dropzone').forEach(function (zone) {
              total += visibleCards(zone).length;
            });
            noResults.classList.toggle('hidden', !(term && total === 0));
          }

          // O CLIENT_SCRIPT (server.mjs) recalcula contador/vazio depois de mover um
          // card, mas contando TODOS os cards. Com filtro ativo isso contradiz a tela,
          // entao reaplicamos o filtro logo depois — em vez de reimplementar as duas
          // funcoes (elas mexem no DOM in-place, nao so' no numero).
          function wrapForFilter() {
            ['updateCounts', 'updateEmptyStates'].forEach(function (name) {
              var original = window[name];
              if (typeof original !== 'function') return;
              window[name] = function () {
                var r = original.apply(this, arguments);
                applyFilter();
                return r;
              };
            });
          }

          input.addEventListener('input', function () {
            writeStored(input.value.trim());
            applyFilter();
          });

          input.value = readStored();
          applyFilter();
          // O CLIENT_SCRIPT e' inline no fim do <body> e so' existe depois deste
          // bloco — por isso o embrulho espera o DOMContentLoaded.
          document.addEventListener('DOMContentLoaded', wrapForFilter);
        })();
      </script>
    </section>
  `;
}

// Ultima vaga: virou o vizinho do input de busca, na MESMA faixa (Opcao A). O
// box antigo custava 160px + 32px de margem = 192px de tela antes do board.
// Ordena por id desc porque o board chega ordenado por applied_at, e aqui a
// pergunta e' "qual foi a ultima que eu criei", nao "qual tem data maior".
// Titulo, empresa, chip da fase e o link sobrevivem na linha; termometro, fonte,
// local e data vao para o title do item — truncar e' visual, nunca de dado.
function renderLatestRow(vagas) {
  if (!vagas || vagas.length === 0) return '';
  const latest = [...vagas].sort((a, b) => b.id - a.id)[0];

  const extra = [
    latest.heat && HEAT_LABELS[latest.heat] ? `Termômetro: ${HEAT_LABELS[latest.heat]}` : '',
    latest.source ? `Fonte: ${capitalize(latest.source)}` : '',
    latest.location_type ? `Local: ${capitalize(latest.location_type)}` : '',
    latest.applied_at ? `Aplicado em ${formatDateFullBR(latest.applied_at)}` : ''
  ].filter(Boolean).join(' · ');
  const rowTitle = `Última vaga: ${latest.title} · ${latest.company}${extra ? ' · ' + extra : ''}`;

  return `
        <div class="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true"></div>
        <div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5" title="${escapeHtml(rowTitle)}">
          <span class="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 md:inline">Última vaga</span>
          <p class="min-w-0 flex-1 truncate text-sm text-slate-700">
            <span class="font-semibold text-slate-900">${escapeHtml(latest.title)}</span>
            <span class="text-slate-400"> · </span>${escapeHtml(latest.company)}
          </p>
          <span class="hidden shrink-0 sm:inline-flex">${getStatusBadge(latest.status)}</span>
          <a href="/vagas/${latest.id}" class="hidden shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 sm:inline-flex">Ver detalhes →</a>
        </div>`;
}

function getStatusBadge(status) {
  const badges = {
    candidated: '<span class="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">Candidatado</span>',
    contacted: '<span class="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">Contato feito</span>',
    interviewing: '<span class="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">Entrevistando</span>',
    offer: '<span class="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">Proposta</span>',
    closed: '<span class="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">Encerrado</span>'
  };
  return badges[status] || '';
}

function getClosedReasonBadge(reason) {
  if (!reason) return '';
  const badges = {
    hired: '<span class="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Contratado</span>',
    rejected: '<span class="shrink-0 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Rejeitado</span>',
    // Desfechos do import Gupy: a empresa encerrou a vaga, ou congelou o processo.
    closed_by_company: '<span class="shrink-0 rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800">Encerrada pela empresa</span>',
    frozen_by_company: '<span class="shrink-0 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">Congelada pela empresa</span>',
    ghosted: '<span class="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Sem retorno</span>',
    withdrew: '<span class="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Desisti</span>'
  };
  return badges[reason] || '';
}

// Legenda do vocabulario de desfecho, no cabecalho da coluna (fora da dropzone).
// Antes ela ficava dentro da area de drop, logo abaixo dos cards, e o usuario
// leu como etiqueta atribuida ao card — nao era, era so legenda decorativa.
// Agora usa bolinha + rotulo para nao imitar chip de card.
function renderClosedReasonsLegend() {
  const dot = (color) => `<span class="inline-block h-1.5 w-1.5 rounded-full ${color}"></span>`;
  return `
    <div class="mb-3 rounded-lg border border-slate-200 bg-white/60 px-2 py-1.5">
      <p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Desfechos possíveis</p>
      <div class="flex flex-wrap gap-x-3 gap-y-1">
        <span class="inline-flex items-center gap-1 text-[11px] text-slate-600">${dot('bg-emerald-500')}Contratado</span>
        <span class="inline-flex items-center gap-1 text-[11px] text-slate-600">${dot('bg-rose-500')}Rejeitado</span>
        <span class="inline-flex items-center gap-1 text-[11px] text-slate-600">${dot('bg-slate-600')}Encerrada pela empresa</span>
        <span class="inline-flex items-center gap-1 text-[11px] text-slate-600">${dot('bg-sky-500')}Congelada pela empresa</span>
        <span class="inline-flex items-center gap-1 text-[11px] text-slate-600">${dot('bg-slate-400')}Sem retorno</span>
        <span class="inline-flex items-center gap-1 text-[11px] text-slate-600">${dot('bg-amber-500')}Desisti</span>
      </div>
    </div>
  `;
}

// Placeholder de coluna vazia. O data-placeholder e' o marcador que o JS usa
// para criar/remover o placeholder durante o movimento in-place dos cards.
// Renderizado SEMPRE (com 'hidden' quando a coluna tem card) para que o filtro
// de busca e o movimento de card tenham um no existente para so' alternar.
function renderEmptyPlaceholder(hidden) {
  return `<div data-placeholder="1" class="${hidden ? 'hidden ' : ''}flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 p-6"><p class="text-xs text-slate-400">Nada por aqui</p></div>`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Termometro: julgamento do usuario sobre a chance da vaga. Nao e' derivado do
// tempo (isso e' o aging) — uma vaga aberta ha 1 mes com 100 candidatos nasce
// fria mesmo tendo sido cadastrada hoje.
const HEAT_STRIPS = {
  hot: 'bg-orange-500',
  warm: 'bg-amber-400',
  cold: 'bg-sky-500'
};

const HEAT_CHIPS = {
  hot: 'bg-orange-100 text-orange-700',
  warm: 'bg-amber-100 text-amber-700',
  cold: 'bg-sky-100 text-sky-700'
};

const HEAT_LABELS = { hot: 'Quente', warm: 'Morna', cold: 'Fria' };

function renderHeat(vaga) {
  if (!vaga.heat) return '';
  const label = HEAT_LABELS[vaga.heat];
  if (!label) return '';
  return `<span class="rounded-md px-2 py-0.5 text-xs font-semibold ${HEAT_CHIPS[vaga.heat]}">${label}</span>`;
}

// DESGASTE (textura do card): escala UNICA por IDADE DA CANDIDATURA. Os limites
// por fase (30/14/7/3) NAO valem mais aqui — mover card nao rejuvenesce a
// candidatura, entao o drop nunca mais reescreve o desgaste. Nome proprio para
// nao ser confundido com a escala de estagnacao logo abaixo.
const WEAR_AGE_LIMITS = { warn: 7, cold: 14, frozen: 30 };

// ESTAGNACAO (rotulo textual de follow-up, SEM textura): quanto silencio cada
// fase tolera. O limite acompanha a fase porque esperar 30 dias por um
// "candidatado" e' normal, mas 3 dias numa "proposta" ja e' pessimo sinal.
// NAO alimenta o desgaste do card — isso e' WEAR_AGE_LIMITS.
const STAGNATION_LIMITS = { candidated: 30, contacted: 14, interviewing: 7, offer: 3, closed: null };

// Nivel do desgaste como numero, para o atributo data-aging do card (a textura
// vive no <style> do renderPage, no server). Encerrada ou sem data e' 0, o
// mesmo valor do estagio limpo.
const AGING_LEVEL_NUM = { ok: 0, warn: 1, cold: 2, frozen: 3 };

// Sem cor de proposito: o canal de cor pertence ao termometro. O ALERTA DE
// ESTAGNACAO vira peso de fonte e contraste na escala de cinza — assim as duas
// escalas nao competem (antes "vermelho" significava quente E atrasado ao mesmo
// tempo). Nao e' o desgaste: a textura do card vem do data-aging no root.
const AGING_STYLES = {
  ok: 'text-xs text-slate-400',
  warn: 'text-xs font-medium text-slate-600',
  cold: 'text-xs font-semibold text-slate-800',
  frozen: 'text-xs font-bold text-slate-900'
};

// Idade da candidatura (applied_at) na escala unica de desgaste. `closed`
// devolve nivel 0: vaga encerrada nao desgasta, mas a idade real dela continua
// no rodape — o dado existe, so' nao vira textura.
function agingOf(vaga) {
  if (!vaga.applied_at) return null;
  const applied = new Date(vaga.applied_at + 'T00:00:00Z');
  if (Number.isNaN(applied.getTime())) return null;
  const today = new Date(todayLocalISO() + 'T00:00:00Z');
  const ageDays = Math.max(0, Math.round((today - applied) / 86400000));
  let level = 'ok';
  if (vaga.status !== 'closed') {
    if (ageDays >= WEAR_AGE_LIMITS.frozen) level = 'frozen';
    else if (ageDays >= WEAR_AGE_LIMITS.cold) level = 'cold';
    else if (ageDays >= WEAR_AGE_LIMITS.warn) level = 'warn';
  }
  return { ageDays, level };
}

// Dias parados desde o ultimo movimento. Derivado do status_changed_at (que so
// o servidor grava) — nunca digitado, por isso nao mente quando o usuario
// esquece de atualizar.
function stagnationOf(vaga) {
  const limit = STAGNATION_LIMITS[vaga.status];
  if (limit == null || !vaga.status_changed_at) return null;
  const changed = new Date(vaga.status_changed_at + 'T00:00:00Z');
  if (Number.isNaN(changed.getTime())) return null;
  const today = new Date(todayLocalISO() + 'T00:00:00Z');
  const days = Math.max(0, Math.round((today - changed) / 86400000));
  let level = 'ok';
  if (days >= limit * 2) level = 'frozen';
  else if (days >= limit) level = 'cold';
  else if (days >= Math.ceil(limit / 2)) level = 'warn';
  return { days, level, limit };
}

function renderAging(vaga) {
  // Encerrada: o cliente limpa o rotulo de movimento no drop, entao aqui o
  // rodape mostra a idade REAL da candidatura — dado verdadeiro, sem textura.
  if (vaga.status === 'closed') {
    const a = agingOf(vaga);
    if (!a) return '';
    const title = `Candidatura em ${formatDateFullBR(vaga.applied_at)} — ${a.ageDays} ${a.ageDays === 1 ? 'dia' : 'dias'}`;
    return `<span class="${AGING_STYLES.ok}" title="${title}">candidatura há ${a.ageDays}d</span>`;
  }

  const s = stagnationOf(vaga);
  if (!s) return '';
  const label = s.days === 0 ? 'movi hoje' : `movi há ${s.days}d`;
  // So vira alerta explicito quando passa do limite da fase; antes disso e' so
  // informacao de rodape, nao ruido visual. O limite e' de ESTAGNACAO
  // (STAGNATION_LIMITS), nao da idade da candidatura.
  const alert = s.level === 'cold' || s.level === 'frozen';
  const cls = alert ? AGING_STYLES[s.level] : AGING_STYLES.ok;
  const title = `Movido em ${formatDateFullBR(vaga.status_changed_at)}`
    + (alert ? ` — ${s.days} dias parado (limite desta fase: ${s.limit})` : '');
  return `<span class="${cls}" title="${title}">${label}</span>`;
}

// Abertura da vaga: ha quantos dias ela estava aberta quando voce aplicou. E'
// contexto para julgar o termometro (vaga velha costuma estar mais concorrida),
// nao um alerta de atraso — o atraso e' o aging, e o desgaste visual dele vem do
// data-aging no root do card (CSS do server). Opcao A aprovada: no card o
// intervalo vira PRESENCA de numeral no rodape (2o elemento mais visivel depois
// do titulo), nao chip cinza igual as outras tags — sobre a poeira dos estagios
// finais, peso de texto e' o que sobrevive.
function renderOpenedGap(vaga) {
  if (!vaga.opened_at) return '';
  const gap = daysBetween(vaga.opened_at, vaga.applied_at);
  if (gap == null) return '';
  const label = gap === 1 ? 'dia aberto antes' : 'dias abertos antes';
  const title = `Vaga aberta em ${formatDateBR(vaga.opened_at)} — ${gap} ${gap === 1 ? 'dia' : 'dias'} antes da sua candidatura`;
  return `
            <div class="mb-1.5 flex items-baseline gap-2" title="${escapeHtml(title)}">
              <span class="shrink-0 text-sm font-bold leading-none text-slate-900">${gap}</span>
              <!-- min-w-0 e SEM truncate: o rotulo quebra em duas linhas em vez de
                   virar "DIAS ABERT…". Numeral e' curto, entao quem cede e' o texto. -->
              <span class="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">${label}</span>
            </div>`;
}

// Dias entre duas datas YYYY-MM-DD, sempre em UTC (mesma referencia do aging).
// Usado pelos chips de saldo de tempo do card; abre com NULL quando falta data,
// o formato quebra ou a ordem e' inconsistente — dado ruim nao vira rotulo.
function daysBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(from + 'T00:00:00Z');
  const b = new Date(to + 'T00:00:00Z');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const diff = Math.round((b - a) / 86400000);
  return diff < 0 ? null : diff;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

// Data absoluta completa, para os tooltips do rodape (o texto visivel usa a
// forma curta; o title carrega o dado sem ambiguidade).
function formatDateFullBR(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
