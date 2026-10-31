/**
 * RenderDetails — detalhe da vaga com timeline, ações e mover fase
 * @param {Object} vaga — vaga completa do DB
 * @returns {string} HTML string
 */
import { todayLocalISO } from '../dates.mjs';

export function renderDetails(vaga) {
  const statusBadge = getStatusBadge(vaga.status);
  const sourceLabel = vaga.source ? `<span class="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">${capitalize(vaga.source)}</span>` : '';
  const locationLabel = vaga.location_type ? `<span class="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">${capitalize(vaga.location_type)}</span>` : '';
  const heatLabel = vaga.heat ? `<span class="rounded-md px-2.5 py-1 text-xs font-semibold ${HEAT_CHIPS[vaga.heat]}">${HEAT_LABELS[vaga.heat]}</span>` : '';
  const appliedAt = formatDateBR(vaga.applied_at);
  const closedAt = vaga.closed_at ? formatDateBR(vaga.closed_at) : '—';

  // Abertura da vaga: quando informada, mostra o intervalo ate a candidatura.
  // Vaga que ficou semanas aberta antes de voce aplicar costuma estar mais
  // concorrida — o dado e' contexto, nao julgamento (isso e' o termometro).
  const openedAt = vaga.opened_at ? formatDateBR(vaga.opened_at) : '';
  const openedGap = daysBetween(vaga.opened_at, vaga.applied_at);
  // Vazio tambem aparece: campo escondido quando nao preenchido faz o recurso
  // parecer inexistente (ninguem descobre que da pra preencher). Mesmo padrao do
  // "Encerrado em: —" logo abaixo. So aqui e' editavel — o chip do card esconde.
  const openedLine = openedAt
    ? `<p class="mt-1 text-xs text-slate-500">Abertura: ${openedAt}${openedGap != null ? ` (há ${openedGap} ${openedGap === 1 ? 'dia' : 'dias'} até a candidatura)` : ''}</p>`
    : `<p class="mt-1 text-xs text-slate-400">Abertura: — <span class="text-slate-400">(informe na edição)</span></p>`;

  // Tempo de anuncio (Opcao A aprovada): o intervalo abertura->candidatura e' o
  // 2o dado mais visivel da pagina, depois do titulo da vaga. Numeral grande +
  // as duas datas em dd/mm; a linha de contexto com a data completa ja vive no
  // dd acima, entao aqui o dado e' o INTERVALO, nao a data.
  const openedBlock = vaga.opened_at && openedGap != null
    ? `
            <div class="mt-6 border-t border-slate-100 pt-5">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Tempo de anúncio</p>
              <div class="mt-2 flex items-baseline gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span class="text-2xl font-bold leading-none tracking-tight text-slate-900">${openedGap}</span>
                <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">${openedGap === 1 ? 'dia de anúncio antes da candidatura' : 'dias de anúncio antes da candidatura'}</span>
              </div>
              <p class="mt-1.5 text-[11px] text-slate-500">Publicada em <span class="font-semibold text-slate-800">${formatDateShortBR(vaga.opened_at)}</span> · candidatura em <span class="font-semibold text-slate-800">${formatDateShortBR(vaga.applied_at)}</span></p>
            </div>`
    : '';

  // Default do input de data das anotacoes — data LOCAL, igual `dates.mjs`
  // (o navegador em UTC mandaria o dia errado depois das 21h locais).
  const todayISO = todayLocalISO();

  // Alerta de retorno derivado do ultimo movimento — nunca digitado, por isso
  // nao mente quando o usuario esquece de atualizar. Escala de cinza de proposito:
  // a cor do card pertence ao termometro, que e' julgamento do usuario.
  const aging = agingOf(vaga);
  const agingLabel = aging
    ? (aging.days === 0 ? 'hoje' : 'há ' + aging.days + (aging.days === 1 ? ' dia' : ' dias'))
    : '—';
  const agingClass = aging
    ? (aging.level === 'frozen' ? 'font-bold text-slate-900'
      : aging.level === 'cold' ? 'font-semibold text-slate-800'
      : aging.level === 'warn' ? 'font-medium text-slate-600' : 'text-slate-900')
    : 'text-slate-400';

  // Linha absoluta da ultima movimentacao: a celula acima da o relativo
  // ("hoje" / "há 5 dias"), que sozinho nao diz quando foi. O desgaste nao
  // desce para o detalhe — aqui e' data, texto, nada de textura.
  const movedLine = vaga.status_changed_at
    ? `<p class="mt-1 text-xs text-slate-500">Última movimentação: ${formatDateBR(vaga.status_changed_at)}</p>`
    : '';

  return `
    <section>
      <a href="/" class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
        <span aria-hidden="true">&larr;</span> Voltar para o board
      </a>
      <p class="text-sm font-semibold uppercase tracking-wider text-indigo-600">Detalhes</p>
      <h2 class="mt-1 text-3xl font-bold tracking-tight text-slate-900">${escapeHtml(vaga.title)}</h2>
      <p class="mt-2 text-slate-600">${escapeHtml(vaga.company)}</p>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-wrap items-center gap-2">
              ${statusBadge}
              ${heatLabel}
              ${sourceLabel}
              ${locationLabel}
            </div>

            <dl class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Aplicado em</dt>
                <dd class="mt-1 text-sm font-medium text-slate-900">${appliedAt}</dd>
                ${openedLine}
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Último movimento</dt>
                <dd class="mt-1 text-sm font-medium ${agingClass}">${agingLabel}</dd>
                ${movedLine}
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Encerrado em</dt>
                <dd class="mt-1 text-sm text-slate-400">${closedAt}</dd>
              </div>
            </dl>

            ${openedBlock}

            <div class="mt-6 border-t border-slate-100 pt-5">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Anotações</p>

              <form id="note-form" class="mt-3 flex flex-col gap-2 sm:flex-row">
                <input id="note-date" type="date" value="${todayISO}" class="${NOTE_INPUT} sm:w-40">
                <input id="note-text" type="text" placeholder="Ex: recruiter pediu pretensão salarial" class="${NOTE_INPUT} sm:flex-1">
                <button type="submit" class="${NOTE_BTN_PRIMARY}">Adicionar</button>
              </form>

              <p id="note-error" class="mt-2 hidden text-xs text-rose-600"></p>
              <ul id="note-list" class="mt-4 space-y-3"></ul>
              <p id="note-empty" class="mt-4 text-sm text-slate-400">Nenhuma anotação ainda.</p>
              ${NOTE_SAFELIST}
            </div>

            <script>${notesScript(vaga.id)}</script>

            ${vaga.url ? `
            <div class="mt-6 border-t border-slate-100 pt-5">
              <a href="${escapeAttr(vaga.url)}" target="_blank" rel="noopener noreferrer" class="text-sm font-semibold text-indigo-600 hover:text-indigo-500">Ver anúncio original →</a>
            </div>
            ` : ''}
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 class="font-semibold text-slate-900">Mover para outra fase</h3>
            <p class="mt-1 text-sm text-slate-600">Trocar de fase atualiza o registro; encerrar exige um desfecho.</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onclick="moveStatus('${vaga.id}', 'contacted')">Contato feito</button>
              <button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onclick="moveStatus('${vaga.id}', 'interviewing')">Entrevistando</button>
              <button class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onclick="moveStatus('${vaga.id}', 'offer')">Proposta</button>
              <button class="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                      onclick="handleClose('${vaga.id}')">Encerrar</button>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Linha do tempo</h3>
            <ol class="mt-4 space-y-4">
              <li class="flex gap-3">
                <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600"></span>
                <div>
                  <p class="text-sm font-medium text-slate-900">Candidatura enviada</p>
                  <p class="text-xs text-slate-500">${appliedAt}</p>
                </div>
              </li>
              ${vaga.closed_at ? `
              <li class="flex gap-3">
                <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${vaga.closed_reason === 'hired' ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                <div>
                  <p class="text-sm font-medium text-slate-900">${getClosedReasonLabel(vaga.closed_reason)}</p>
                  <p class="text-xs text-slate-500">${closedAt}</p>
                </div>
              </li>
              ` : `
              <li class="flex gap-3">
                <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300"></span>
                <div>
                  <p class="text-sm text-slate-400">Aguardando retorno</p>
                </div>
              </li>
              `}
            </ol>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Ações</h3>
            <div class="mt-4 space-y-2">
              <a href="/vagas/${vaga.id}/edit" class="block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">Editar vaga</a>
              <button type="button" onclick="confirmDelete('${vaga.id}')" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Excluir</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

// Termometro: julgamento do usuario sobre a chance da vaga (nao e' derivado do
// tempo — isso e' o aging). Espelha views/board.mjs.
const HEAT_CHIPS = {
  hot: 'bg-orange-100 text-orange-700',
  warm: 'bg-amber-100 text-amber-700',
  cold: 'bg-sky-100 text-sky-700'
};

const HEAT_LABELS = { hot: 'Quente', warm: 'Morna', cold: 'Fria' };

// --- Anotacoes (job_notes) ---
// Classes reaproveitadas do padrao visual da UI. As que so aparecem em elementos
// criados por JS depois do primeiro paint vao tambem no NOTE_SAFELIST: o Tailwind
// CDN compila o CSS a partir do HTML inicial, entao sem isso os itens da lista
// nasceriam sem estilo (mesma armadilha do drag no board).
const NOTE_INPUT = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const NOTE_BTN_PRIMARY = 'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500';
const NOTE_BTN_SECONDARY = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50';
const NOTE_ITEM = 'flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2';
const NOTE_EDIT_ITEM = 'flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 sm:flex-row sm:items-center';
const NOTE_BODY = 'min-w-0';
const NOTE_DATE = 'text-xs font-semibold text-slate-500';
const NOTE_TEXT = 'mt-0.5 text-sm text-slate-700 break-words';
const NOTE_ACTIONS = 'flex shrink-0 items-start gap-2';
const NOTE_EDIT_BTN = 'text-xs font-semibold text-indigo-600 hover:text-indigo-500';
const NOTE_DEL_BTN = 'text-xs font-semibold text-rose-600 hover:text-rose-500';

const NOTE_SAFELIST = `<span aria-hidden="true" style="display:none" class="${NOTE_ITEM} ${NOTE_EDIT_ITEM} ${NOTE_BODY} ${NOTE_DATE} ${NOTE_TEXT} ${NOTE_ACTIONS} ${NOTE_EDIT_BTN} ${NOTE_DEL_BTN}"></span>`;

// JS das anotacoes embutido no HTML do detalhe: sem bundle, sem framework. Tudo
// montado por DOM (createElement/textContent) para o texto do usuario nunca ser
// interpretado como HTML. Sem template literal interno de proposito — este
// codigo vive dentro de um template literal e as chaves seriam interpoladas.
function notesScript(jobId) {
  return `
  (function () {
    var JOB_ID = ${jobId};
    var base = '/vagas/' + JOB_ID + '/notes';
    var listEl = document.getElementById('note-list');
    var emptyEl = document.getElementById('note-empty');
    var formEl = document.getElementById('note-form');
    var dateEl = document.getElementById('note-date');
    var textEl = document.getElementById('note-text');
    var errorEl = document.getElementById('note-error');
    if (!listEl || !formEl) return;

    function showError(msg) {
      errorEl.textContent = msg || '';
      errorEl.classList.toggle('hidden', !msg);
    }

    // 'YYYY-MM-DD' -> 'DD/MM/YYYY' (espelha formatDateBR das views).
    function formatBR(d) {
      if (!d) return '';
      var p = String(d).split('-');
      return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d;
    }

    function make(tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      return node;
    }

    // fetch com corpo JSON e surfando o {error} da API.
    function api(method, url, body) {
      var opts = { method: method, headers: { 'Accept': 'application/json' } };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      return fetch(url, opts).then(function (res) {
        if (res.status === 204) return null;
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || 'Erro inesperado');
          return data;
        });
      });
    }

    function load() {
      return api('GET', base).then(render, function (err) { showError(err.message); });
    }

    function render(notes) {
      showError('');
      listEl.textContent = '';
      var list = notes || [];
      emptyEl.classList.toggle('hidden', list.length > 0);
      list.forEach(function (n) { listEl.appendChild(viewRow(n)); });
    }

    function viewRow(n) {
      var li = make('li', ${JSON.stringify(NOTE_ITEM)});
      var body = make('div', ${JSON.stringify(NOTE_BODY)});
      body.appendChild(make('p', ${JSON.stringify(NOTE_DATE)}, formatBR(n.note_date)));
      body.appendChild(make('p', ${JSON.stringify(NOTE_TEXT)}, n.text));
      li.appendChild(body);

      var actions = make('div', ${JSON.stringify(NOTE_ACTIONS)});
      var edit = make('button', ${JSON.stringify(NOTE_EDIT_BTN)}, 'Editar');
      edit.type = 'button';
      edit.addEventListener('click', function () { li.replaceWith(editRow(n)); });
      var del = make('button', ${JSON.stringify(NOTE_DEL_BTN)}, 'Excluir');
      del.type = 'button';
      del.addEventListener('click', function () {
        // Exclusao pelo modal do app (openConfirm vive no CLIENT_SCRIPT). Sem
        // fallback para confirm() nativo: se a funcao faltar, NAO exclui —
        // apagar sem aviso e' pior que nao apagar.
        if (typeof openConfirm !== 'function') {
          showError('Não foi possível abrir a confirmação. Recarregue a página.');
          return;
        }
        openConfirm({
          title: 'Excluir esta anotação?',
          message: 'Essa ação não pode ser desfeita.',
          confirmLabel: 'Excluir anotação',
          onConfirm: function () {
            return api('DELETE', base + '/' + n.id).then(load, function (err) { showError(err.message); });
          }
        });
      });
      actions.appendChild(edit);
      actions.appendChild(del);
      li.appendChild(actions);
      return li;
    }

    function editRow(n) {
      var li = make('li', ${JSON.stringify(NOTE_EDIT_ITEM)});
      var dateIn = make('input', ${JSON.stringify(NOTE_INPUT + ' sm:flex-1')});
      dateIn.type = 'date';
      dateIn.value = n.note_date || '';
      var textIn = make('input', ${JSON.stringify(NOTE_INPUT + ' sm:flex-1')});
      textIn.type = 'text';
      textIn.value = n.text || '';

      var actions = make('div', ${JSON.stringify(NOTE_ACTIONS)});
      var save = make('button', ${JSON.stringify(NOTE_BTN_PRIMARY)}, 'Salvar');
      save.type = 'button';
      save.addEventListener('click', function () {
        api('PATCH', base + '/' + n.id, { note_date: dateIn.value, text: textIn.value })
          .then(load, function (err) { showError(err.message); });
      });
      var cancel = make('button', ${JSON.stringify(NOTE_BTN_SECONDARY)}, 'Cancelar');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { li.replaceWith(viewRow(n)); });
      actions.appendChild(save);
      actions.appendChild(cancel);

      li.appendChild(dateIn);
      li.appendChild(textIn);
      li.appendChild(actions);
      return li;
    }

    formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      api('POST', base, { note_date: dateEl.value, text: textEl.value }).then(function () {
        textEl.value = '';
        return load();
      }, function (err) { showError(err.message); });
    });

    load();
  })();
  `;
}

function getStatusBadge(status) {
  const badges = {
    candidated: '<span class="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Candidatado</span>',
    contacted: '<span class="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">Contato feito</span>',
    interviewing: '<span class="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">Entrevistando</span>',
    offer: '<span class="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">Proposta</span>',
    closed: '<span class="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Encerrado</span>'
  };
  return badges[status] || '';
}

function getClosedReasonLabel(reason) {
  const labels = {
    hired: 'Contratado',
    rejected: 'Rejeitado',
    // Desfechos do import Gupy: a empresa encerrou a vaga, ou congelou o processo.
    closed_by_company: 'Encerrada pela empresa',
    frozen_by_company: 'Congelada pela empresa',
    ghosted: 'Sem retorno',
    withdrew: 'Desisti'
  };
  return labels[reason] || 'Encerrado';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ESTAGNACAO (rotulo textual, nunca desgaste): quanto silencio cada fase tolera
// antes do follow-up virar alerta. O limite acompanha a fase porque esperar 30
// dias por um "candidatado" e' normal, mas numa "proposta" ja e' pessimo sinal.
// O DESGASTE visual da pagina nao existe (decisao: detalhe nao recebe textura) —
// esta escala so' alimenta a linha "Ultimo movimento" como alerta em texto.
const STAGNATION_LIMITS = { candidated: 30, contacted: 14, interviewing: 7, offer: 3, closed: null };

function agingOf(vaga) {
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

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Versao curta dd/mm (sem ano) para o par de datas do bloco de tempo de
// anuncio: as duas datas sao do mesmo ciclo, o ano so' polui.
function formatDateShortBR(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
}

// Dias entre duas datas 'YYYY-MM-DD' (UTC, mesma referencia do aging). Negativo
// (abertura depois da candidatura) vira 0 — dado inconsistente nao pode virar
// "há -3 dias" na tela.
function daysBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(from + 'T00:00:00Z');
  const b = new Date(to + 'T00:00:00Z');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
