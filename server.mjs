import http from 'node:http';
import { renderBoard } from './views/board.mjs';
import { renderForm } from './views/form.mjs';
import { renderDetails } from './views/details.mjs';
import { todayLocalISO } from './dates.mjs';

// node:sqlite só existe a partir do Node 22. Sem este guard, uma versão antiga
// falha com "No such built-in module: node:sqlite" sem dizer o que fazer.
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) {
  console.error(
    `GenVagas precisa do Node.js 22 ou superior (node:sqlite). Você está no ${process.versions.node}.`
  );
  process.exit(1);
}

// Silencia o ExperimentalWarning do node:sqlite antes de carregar o db.
// Import dinâmico é obrigatório: imports estáticos são hoisted e avaliados
// antes de qualquer statement deste módulo.
process.removeAllListeners('warning');

const {
  createJob, getJobs, getJobById, updateJob, deleteJob, getPositionsByStatus,
  getNotesByJob, createNote, getNoteById, updateNote, deleteNote, DB_PATH
} = await import('./db.mjs');

const PORT = Number(process.env.PORT) || 3000;

// --- helpers de payload ---

// Campo opcional vazio chega como '' do form HTML e violaria os CHECK do schema.
function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

// Calcula a position de um card que acabou de ser solto numa coluna.
// O cliente manda a posicao desejada como id do card *vizinho de cima*
// (afterId) — null significa "primeiro da coluna". O valor novo e' a media
// entre a position dos dois vizinhos: nao renumera nada e a ordem fica estavel.
// Se os vizinhos estiverem colados (media == vizinho), renumera a coluna.
function positionFor(status, afterId) {
  const rows = getPositionsByStatus.all(status);
  if (rows.length === 0) return 1;

  if (afterId == null) {
    // Primeiro da coluna: metade do menor valor existente. Inserir no topo toda
    // vez converge para zero e, no limite, a metade para de mudar (denormal) —
    // a ordem passaria a depender do desempate (applied_at/id) em vez da ordem
    // manual. Mesma guarda do ramo do meio: sem espaco, renumera e recalcula.
    const first = rows[0].position;
    const half = first / 2;
    if (half === first || half <= 0) {
      renumberColumn(status);
      return positionFor(status, afterId);
    }
    return half;
  }

  const idx = rows.findIndex((r) => r.id === Number(afterId));
  if (idx === -1) {
    // Vizinho nao esta nesta coluna: cai no fim.
    return rows[rows.length - 1].position + 1;
  }

  const after = rows[idx].position;
  const next = rows[idx + 1];
  if (!next) return after + 1;

  const mid = (after + next.position) / 2;
  // Sem espaco entre os dois (float esgotado): renumera a coluna inteira.
  if (mid === after || mid === next.position) {
    renumberColumn(status);
    return positionFor(status, afterId);
  }
  return mid;
}

// Reescreve positions de uma coluna como 1,2,3... Mantem a ordem relativa.
function renumberColumn(status) {
  const rows = getPositionsByStatus.all(status);
  rows.forEach((row, i) => {
    const job = getJobById.get(row.id);
    updateJob.run(
      job.title, job.company, job.applied_at, job.opened_at, job.status, job.url, job.source,
      job.location_type, job.status_changed_at, job.closed_at,
      job.closed_reason, i + 1, job.heat, job.id
    );
  });
}

function normalizeJob(input) {
  return {
    title: clean(input.title),
    company: clean(input.company),
    applied_at: clean(input.applied_at),
    // Data de abertura da vaga: opcional, independente da candidatura.
    opened_at: clean(input.opened_at),
    status: clean(input.status),
    url: clean(input.url),
    source: clean(input.source),
    location_type: clean(input.location_type),
    // status_changed_at NAO entra: o relogio de movimento e' do servidor, sempre.
    // Aceitar do corpo deixava o cliente forjar (ou zerar) o alerta de follow-up.
    closed_at: clean(input.closed_at),
    closed_reason: clean(input.closed_reason),
    // Ordem dentro da coluna. O form não manda; o drag manda via afterId.
    position: input.position === undefined || input.position === null ? null : Number(input.position),
    // Termômetro: julgamento do usuário, não derivado. '' do form vira null.
    heat: clean(input.heat)
  };
}

// O form HTML envia urlencoded; fetch do board envia JSON. Aceita os dois.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          resolve(raw ? JSON.parse(raw) : {});
        } else {
          resolve(Object.fromEntries(new URLSearchParams(raw)));
        }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Regras de domínio compartilhadas por criação e edição — antes viviam só no
// update, então o POST aceitava closed sem desfecho e gravava closed_at null.
// Retorna null quando válido, ou o erro a devolver. Muta closed_at quando aplica.
const HEAT_VALUES = ['hot', 'warm', 'cold'];
// Vocabulario canonico do desfecho — fonte unica: alimenta o modal do cliente
// (serializado no CLIENT_SCRIPT abaixo) e a validacao de validateJob. Ordem do
// array = ordem em que os botoes aparecem na tela.
const CLOSE_REASONS = [
  { value: 'hired',             label: 'Contratado',             dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  { value: 'rejected',          label: 'Rejeitado',              dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700' },
  { value: 'closed_by_company', label: 'Encerrada pela empresa', dot: 'bg-slate-600',   badge: 'bg-slate-200 text-slate-800' },
  { value: 'frozen_by_company', label: 'Congelada pela empresa', dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700' },
  { value: 'ghosted',           label: 'Sem retorno',            dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600' },
  { value: 'withdrew',          label: 'Desisti',                dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700' }
];
// Formato aceito por <input type="date"> e pelo SQLite DATE. Comparacao textual
// basta: o padrao ISO ordena igual a data.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateJob(job) {
  if (!job.title || !job.company || !job.applied_at) {
    return { status: 400, error: 'title, company and applied_at are required' };
  }
  if (job.opened_at != null && !DATE_RE.test(job.opened_at)) {
    return { status: 400, error: 'Invalid opened_at (expected YYYY-MM-DD)' };
  }
  // O CHECK do schema nao vale em bancos migrados: ALTER TABLE ADD COLUMN nao
  // carrega constraint. Entao a validacao vive aqui, onde vale para os dois casos.
  if (job.heat != null && !HEAT_VALUES.includes(job.heat)) {
    return { status: 400, error: 'Invalid heat value (expected hot, warm or cold)' };
  }
  if (job.status === 'closed') {
    // Ausente e invalido sao erros diferentes: o modal do cliente trata o code
    // de ausencia (abre a escolha do desfecho), e o code nao pode mudar. O
    // vocabulario e' fechado aqui porque o CHECK saiu do schema (db.mjs).
    if (!job.closed_reason) {
      return { status: 400, error: 'Closing requires a reason', code: 'closed_reason_required' };
    }
    if (!CLOSE_REASONS.some((r) => r.value === job.closed_reason)) {
      return {
        status: 400,
        error: `Invalid closed_reason (expected ${CLOSE_REASONS.map((r) => r.value).join(', ')})`,
        code: 'closed_reason_invalid'
      };
    }
    if (!job.closed_at) {
      job.closed_at = todayLocalISO();
    }
  }
  return null;
}

// Data do calendário do usuário vem de dates.mjs (mesma definição para server e
// views).

// Persiste um merge de job existente. Usado por PATCH, PUT e POST de edição.
function persistJob(id, incoming) {
  const existing = getJobById.get(id);
  if (!existing) return { status: 404, error: 'Job not found' };

  const merged = normalizeJob({ ...existing, ...incoming });
  const invalid = validateJob(merged);
  if (invalid) return invalid;

  if (merged.status !== 'closed' && existing.status === 'closed') {
    // Reabrir: o desfecho anterior não vale mais para a fase nova.
    merged.closed_at = null;
    merged.closed_reason = null;
  }

  // O relógio de movimento nunca vem do cliente (normalizeJob não o aceita):
  // edição de campo mantém o valor do banco.
  merged.status_changed_at = existing.status_changed_at;

  // Só a MUDANÇA de fase reinicia o relógio de estagnação. Editar o telefone
  // da vaga não é movimento — senão o alerta zeraria sem a vaga ter andado.
  if (merged.status !== existing.status) {
    merged.status_changed_at = todayLocalISO();
  }

  // afterId vem do drag: e' o id do card que ficou ACIMA do solto (null = primeiro).
  // Vale tanto ao trocar de coluna quanto ao reordenar dentro da mesma.
  const wantsReposition = incoming.afterId !== undefined;
  if (wantsReposition) {
    const afterId = incoming.afterId === null || incoming.afterId === '' ? null : Number(incoming.afterId);
    // Sair da lista atual antes de calcular: senao o proprio card entra como vizinho.
    merged.position = positionFor(merged.status, afterId === existing.id ? null : afterId);
  } else if (merged.status !== existing.status) {
    // Movimento simples entre colunas: vai para o fim, como antes.
    const rows = getPositionsByStatus.all(merged.status);
    merged.position = rows.length ? rows[rows.length - 1].position + 1 : 1;
  }

  updateJob.run(
    merged.title, merged.company, merged.applied_at, merged.opened_at, merged.status, merged.url,
    merged.source, merged.location_type, merged.status_changed_at,
    merged.closed_at, merged.closed_reason, merged.position, merged.heat, id
  );
  return { status: 200, job: merged };
}

// HTML é montado por request a partir do DB; sem no-store o browser serve
// leitura velha (modal do ?nova=1 abrindo com estado antigo, board defasado).
function sendHtml(res, body) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

// --- shell HTML ---

// O Tailwind CDN compila APENAS as classes que encontra no HTML no primeiro
// paint. Classe utilitaria aplicada por JS a um elemento criado depois fica SEM
// CSS (foi o que fez a linha de insercao do drag ter altura 0 e ser invisivel).
// Safelist: estas classes aparecem neste script block para o JIT compilar,
// mesmo sem nenhum elemento estatico usando-as.
const TW_SAFELIST = `
  <span class="hidden overflow-hidden"></span>
  <span class="pointer-events-none absolute left-0 right-0 h-0.5 rounded-full bg-indigo-500"></span>
  <span class="ring-2 ring-indigo-300"></span>
  <span class="bg-orange-500 bg-amber-400 bg-sky-500 bg-slate-200 bg-slate-600"></span>
  <span class="bg-orange-100 text-orange-700 bg-amber-100 text-amber-700 bg-sky-100 text-sky-700 bg-sky-50 text-slate-800"></span>
  <span class="border-orange-300 bg-orange-50/40"></span>
`;

const CLIENT_SCRIPT = `
  var MODAL_IDS = ['modal-nova-vaga', 'modal-desfecho', 'modal-delete'];

  function toggleModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var opening = el.classList.contains('hidden');
    el.classList.toggle('hidden', !opening);
    syncBodyScrollLock();
  }
  function syncBodyScrollLock() {
    var anyOpen = MODAL_IDS.some(function (id) {
      var el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    });
    document.body.classList.toggle('overflow-hidden', anyOpen);
  }

  // --- arrastar e soltar ---
  var draggedCard = null;
  function drag(ev) {
    // O card tem um <a> por dentro para abrir o detalhe. Se o arrasto nasce no
    // link, ev.target e' o <a> e nao carrega data-id — por isso subimos ate o
    // card, que e' o elemento com os dados (fonte unica do id/status).
    var card = ev.target.closest('.card');
    if (!card) return;
    draggedCard = card;
    ev.dataTransfer.setData('text/plain', card.dataset.id);
    ev.dataTransfer.effectAllowed = 'move';
  }
  function allowDrop(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  }
  // Cards que contam para decidir posicao visual: fora o proprio arrastado e
  // fora os escondidos pela busca. Card com .hidden continua no DOM (decisao do
  // filtro — remover quebraria o drag), mas devolve getBoundingClientRect()
  // 0,0,0,0, o que o fazia passar pelo midpoint, virar "after" e gravar um
  // data-afterId apontando para card invisivel: soltar com busca ativa salvava
  // a posicao errada.
  function visibleCards(zone) {
    return [].slice.call(zone.querySelectorAll('.card')).filter(function (c) {
      return c !== draggedCard && !c.classList.contains('hidden');
    });
  }

  // Durante o arrasto, descobre em qual vao o cursor esta e mostra uma linha de
  // insercao ali. Sem isso o usuario nao sabe onde o card vai cair.
  function dragOverCard(ev, zone) {
    allowDrop(ev);
    if (!draggedCard) return;
    var cards = visibleCards(zone);
    var after = null;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      // Metade de cima: cai antes deste card. Metade de baixo: continua procurando.
      if (ev.clientY < r.top + r.height / 2) break;
      after = cards[i];
    }
    showDropMarker(zone, after, cards);
  }

  // Linha de insercao. Precisa ser ABSOLUTA: um marcador no fluxo normal
  // empurraria os cards abaixo, mudando a geometria que decide onde ele mesmo
  // fica — o resultado era a linha tremendo enquanto o cursor se movia.
  //
  // Estilo INLINE, nao classes: o Tailwind CDN so compila o que encontra no HTML
  // no primeiro paint, entao classe utilitaria aplicada a elemento criado depois
  // por JS fica sem CSS (h-0.5 resolvia para 0px e a linha era invisivel).
  function showDropMarker(zone, after, cards) {
    var marker = zone.querySelector('[data-drop-marker]');
    if (!marker) {
      marker = document.createElement('div');
      marker.setAttribute('data-drop-marker', '1');
      // As classes abaixo dependem da TW_SAFELIST: sem ela o Tailwind CDN nao
      // compila h-0.5 e a linha fica com altura 0 (invisivel).
      marker.className = 'pointer-events-none absolute left-0 right-0 h-0.5 rounded-full bg-indigo-500';
      // O dropzone tem space-y-3: o Tailwind aplica margin-top em TODO filho a
      // partir do segundo — inclusive neste absolute, que entao caia 12px abaixo
      // do vao calculado. Zerar a margem e mais honesto que compensar no top.
      marker.style.marginTop = '0';
      zone.appendChild(marker);
    }
    var zoneTop = zone.getBoundingClientRect().top;
    // O filho absolute se posiciona a partir do TOPO DO CONTEUDO do dropzone, mas
    // as medidas dos cards vem da tela: com a coluna rolada (overflow-y-auto, o
    // padrao do board agora) falta somar o scroll, senao a linha aparece scrollTop
    // pixels acima do vao (medido: -287px com scrollTop=300).
    var scrolled = zone.scrollTop;
    var top;
    if (after) {
      // Logo abaixo do card ancora, no meio do gap.
      top = after.getBoundingClientRect().bottom - zoneTop + 6 + scrolled;
    } else if (cards.length) {
      // Logo acima do primeiro card.
      top = cards[0].getBoundingClientRect().top - zoneTop - 6 + scrolled;
    } else {
      top = 0;
    }
    marker.style.top = top + 'px';
    // Guardado no proprio elemento: a posicao fica estavel e nao depende de
    // vasculhar irmaos no DOM na hora do drop.
    marker.dataset.afterId = after ? after.dataset.id : '';
  }

  function clearDropMarker(zone) {
    var m = zone.querySelector('[data-drop-marker]');
    if (m) m.remove();
  }

  // dragleave tambem dispara ao passar de um card para outro DENTRO da zona
  // (o evento borbulha). Limpar ai fazia a linha piscar; so limpa se o cursor
  // realmente saiu da zona.
  function dragLeaveZone(ev, zone) {
    if (ev.relatedTarget && zone.contains(ev.relatedTarget)) return;
    clearDropMarker(zone);
  }

  // Soltar fora de qualquer coluna (ou cancelar com Esc) nao dispara drop:
  // sem isso a linha de insercao ficava presa na tela.
  function endDrag() {
    document.querySelectorAll('[data-drop-marker]').forEach(function (m) { m.remove(); });
    draggedCard = null;
  }

  // Posicao escolhida pelo cursor, lida do marcador. String vazia = primeiro
  // da coluna (null para o servidor); undefined = nao houve marcador.
  function insertionAfterId(zone) {
    var marker = zone.querySelector('[data-drop-marker]');
    if (!marker) return undefined;
    var v = marker.dataset.afterId;
    return v === '' ? null : v;
  }

  function drop(ev, newStatus) {
    ev.preventDefault();
    var zone = ev.currentTarget;
    var afterId = insertionAfterId(zone);
    var id = ev.dataTransfer.getData('text/plain');
    var card = draggedCard || document.querySelector('.card[data-id="' + id + '"]');
    // endDrag zera draggedCard — por isso lemos o card ANTES de chama-lo.
    endDrag();
    if (!card) return;
    moveStatus(card.dataset.id, newStatus, card, afterId);
  }

  // --- mudanca de fase ---
  async function applyStatus(id, status, closedReason, afterId) {
    try {
      var body = { status: status };
      if (closedReason) body.closed_reason = closedReason;
      // afterId definido (inclusive null) = o usuario escolheu onde soltar.
      if (afterId !== undefined) body.afterId = afterId;
      var res = await fetch('/vagas/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) return { ok: true };
      var err = await res.json().catch(function () { return {}; });
      return { ok: false, error: err.error, code: err.code };
    } catch (e) {
      return { ok: false, error: 'Falha de rede ao mover a vaga.' };
    }
  }

  // O PATCH ja persistiu a mudanca. Recarregar a pagina so faria a tela piscar,
  // perder o scroll e reabrir qualquer modal aberto — entao o card e' movido
  // no DOM. Na pagina de detalhe nao existe board para mover: ali o reload e' o certo.
  async function moveStatus(id, status, cardEl, afterId, closedReason) {
    var r = await applyStatus(id, status, closedReason, afterId);
    if (r.ok) {
      if (cardEl) moveCardInPlace(cardEl, status, closedReason, afterId);
      else location.reload();
      return;
    }
    // Encerrar sem desfecho: o servidor recusa e pede a escolha antes de gravar.
    if (r.code === 'closed_reason_required') {
      handleClose(id, cardEl, afterId);
      return;
    }
    window.alert(r.error || 'Nao foi possivel mover a vaga.');
  }

  // Insere o card no DOM exatamente onde ele caiu. Antes era appendChild cego,
  // entao o card ia sempre para o fim da coluna, ignorando o cursor.
  // afterId === undefined (movimento antigo, ex: botao do detalhe) = fim da lista.
  function moveCardInPlace(card, status, closedReason, afterId) {
    var zone = document.querySelector('.column[data-status="' + status + '"] .dropzone');
    if (!zone) return;
    // Fase ANTERIOR antes de sobrescrever: e' o unico jeito de o cliente saber se
    // houve movimento de fase (o servidor so reinicia o relogio quando muda).
    var prevStatus = card.dataset.status;
    card.dataset.status = status;

    var anchor = null;
    if (afterId === null) {
      // Primeiro da coluna: antes do primeiro card visivel que nao seja o proprio.
      anchor = visibleCards(zone)[0] || null;
      if (anchor) anchor.insertAdjacentElement('beforebegin', card);
      else zone.appendChild(card);
    } else if (afterId !== undefined) {
      anchor = zone.querySelector('.card[data-id="' + afterId + '"]');
      // Ancora escondida so aparece com estado velho de filtro: inserir depois
      // dela deixaria o card no meio de um trecho invisivel, entao vai para o fim.
      if (anchor && anchor !== card && !anchor.classList.contains('hidden')) anchor.insertAdjacentElement('afterend', card);
      else zone.appendChild(card);
    } else {
      zone.appendChild(card);
    }

    syncCardBadge(card, status, closedReason, prevStatus);
    // Realce curto para o olho confirmar onde o card caiu.
    zone.classList.add('ring-2', 'ring-indigo-300');
    setTimeout(function () { zone.classList.remove('ring-2', 'ring-indigo-300'); }, 600);
    updateCounts();
    updateEmptyStates();
  }

  // O card so ganhava o badge de desfecho no HTML do servidor. Como o movimento
  // agora e' in-place, o rodape precisa ser reescrito aqui — senao o card chega
  // na coluna Encerrado sem dizer por que encerrou.
  function syncCardBadge(card, status, closedReason, prevStatus) {
    var footer = card.querySelector('.card-footer');
    if (!footer) return;
    // Desfecho e aging sao slots distintos. Antes dividiam o mesmo <span>, e
    // mover um card apagava o aging do outro por sobrescrita.
    var badge = footer.querySelector('[data-badge]');
    if (!badge) {
      badge = document.createElement('span');
      badge.setAttribute('data-badge', '1');
      footer.appendChild(badge);
    }
    var meta = CLOSE_REASONS.filter(function (r) { return r.value === closedReason; })[0];
    if (status === 'closed' && meta) {
      badge.className = 'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ' + meta.badge;
      badge.textContent = meta.label;
    } else {
      badge.className = '';
      badge.textContent = '';
    }
    syncCardAging(card, status, prevStatus);
  }

  // Rotulo de MOVIMENTO (estagnacao) do rodape. O desgaste visual vem de
  // applied_at (textura via data-aging) e nao muda no drop, entao nada de
  // data-aging aqui.
  // Sem cor: o canal de cor pertence ao termometro. Espelha views/board.mjs.
  var AGING_STYLES = {
    ok: 'text-xs text-slate-400',
    warn: 'text-xs font-medium text-slate-600',
    cold: 'text-xs font-semibold text-slate-800',
    frozen: 'text-xs font-bold text-slate-900'
  };

  // 'YYYY-MM-DD' -> 'DD/MM/AAAA' (mesmo formato do title que o servidor emite).
  function formatDateBR(iso) {
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  }

  function syncCardAging(card, status, prevStatus) {
    var footer = card.querySelector('.card-footer');
    if (!footer) return;
    var slot = footer.querySelector('[data-aging-slot]');
    if (!slot) return;
    // Fase encerrada nao tem relogio de follow-up: limpa o rotulo. E nao
    // desgasta: o nivel do CSS vai a zero na hora, sem esperar F5 (antes o card
    // chegava em Encerrado ainda com a textura do estagio anterior).
    if (status === 'closed') {
      slot.textContent = '';
      card.dataset.aging = '0';
      return;
    }
    // Reordenar dentro da MESMA coluna nao e' movimento: o servidor nao tocou em
    // status_changed_at, entao o rotulo e o tooltip ficam como estao. Antes o
    // cliente escrevia "movi hoje" aqui e, de quebra, destruia o title.
    if (prevStatus === status) return;
    // Fase nova: o servidor grava status_changed_at hoje, entao o rotulo zera e o
    // tooltip passa a apontar para hoje (data LOCAL, via dates.mjs injetado no
    // head). Reconstroi o markup do servidor — textContent puro matava o <span>.
    var label = document.createElement('span');
    label.className = AGING_STYLES.ok;
    label.setAttribute('title', 'Movido em ' + formatDateBR(todayLocalISO()));
    label.textContent = 'movi hoje';
    slot.textContent = '';
    slot.appendChild(label);
  }

  function updateCounts() {
    document.querySelectorAll('.column').forEach(function (col) {
      var out = document.getElementById('count-' + col.dataset.status);
      if (out) out.textContent = String(col.querySelectorAll('.card').length);
    });
  }

  // O placeholder de coluna vazia era renderizado so na coluna Proposta, no HTML
  // do servidor. Com o movimento in-place ele precisa acompanhar o estado vivo.
  function updateEmptyStates() {
    document.querySelectorAll('.column .dropzone').forEach(function (zone) {
      var hasCards = !!zone.querySelector('.card');
      var ph = zone.querySelector('[data-placeholder]');
      if (hasCards && ph) ph.remove();
      if (!hasCards && !ph) {
        zone.insertAdjacentHTML('beforeend',
          '<div data-placeholder="1" class="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 p-6"><p class="text-xs text-slate-400">Nada por aqui</p></div>');
      }
    });
  }

  // --- modal de desfecho ---
  // Antes isso era um prompt nativo do browser: nao listava as opcoes, aceitava
  // texto invalido e, ao cancelar, nao acontecia nada — o card ficava parado sem
  // explicacao. Agora e' um modal com as 4 opcoes como botoes.
  var pendingClose = null;
  function handleClose(id, cardEl, afterId) {
    // Guarda onde o card foi solto: ao escolher o desfecho ele precisa cair na
    // posicao que o usuario escolheu, nao no fim da coluna.
    pendingClose = { id: id, card: cardEl || null, afterId: afterId };
    toggleModal('modal-desfecho');
  }
  async function confirmClose(reason) {
    var pending = pendingClose;
    pendingClose = null;
    toggleModal('modal-desfecho');
    if (!pending) return;
    var r = await applyStatus(pending.id, 'closed', reason, pending.afterId);
    if (!r.ok) {
      window.alert(r.error || 'Nao foi possivel encerrar a vaga.');
      return;
    }
    if (pending.card) moveCardInPlace(pending.card, 'closed', reason, pending.afterId);
    else location.href = '/vagas/' + pending.id;
  }

  // Mesma lista do servidor (fonte unica), serializada para o browser.
  var CLOSE_REASONS = ${JSON.stringify(CLOSE_REASONS)};

  function buildCloseModal() {
    if (document.getElementById('modal-desfecho')) return;
    var options = CLOSE_REASONS.map(function (r) {
      return '<button type="button" data-reason="' + r.value + '"' +
        ' class="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50">' +
        '<span class="inline-block h-2 w-2 shrink-0 rounded-full ' + r.dot + '"></span>' + r.label +
        '</button>';
    }).join('');
    document.body.insertAdjacentHTML('beforeend',
      '<div id="modal-desfecho" class="fixed inset-0 z-[60] hidden" role="dialog" aria-modal="true">' +
        '<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="toggleModal(&quot;modal-desfecho&quot;)"></div>' +
        // pointer-events: o wrapper cobre o viewport para centralizar o card; sem
        // o none nele, o clique nunca chega ao backdrop acima e fechar clicando
        // fora fica morto. O card reabilita os eventos para si.
        '<div class="pointer-events-none fixed inset-0 flex items-center justify-center p-4">' +
          '<div class="pointer-events-auto relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5">' +
            '<h3 class="text-lg font-semibold text-slate-900">Qual o desfecho da candidatura?</h3>' +
            '<p class="mt-1 text-sm text-slate-600">A vaga vai para a coluna Encerrado com o desfecho escolhido.</p>' +
            '<div class="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">' + options + '</div>' +
            '<div class="mt-5 flex justify-end">' +
              '<button type="button" onclick="toggleModal(&quot;modal-desfecho&quot;)" class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>');
    document.getElementById('modal-desfecho').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-reason]');
      if (btn) confirmClose(btn.dataset.reason);
    });
  }

  function initModals() {
    buildCloseModal();
    // Portal: os modais passam a ser filhos diretos do <body>. Eles sao montados
    // dentro do <main>, e qualquer ancestral com transform/filter/overflow ali
    // tornaria o position:fixed relativo a ele — o backdrop deixaria de cobrir
    // o viewport inteiro.
    MODAL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentElement !== document.body) document.body.appendChild(el);
    });
  }

  // --- confirmacao destrutiva ---
  // Modal unico e generico no lugar do dialogo nativo do navegador: ele nao
  // aceita a linguagem visual do app (nem cor destrutiva). Criado sob
  // demanda como o modal de desfecho; a acao pendente vive em variavel do
  // modulo porque os botoes sao montados depois e nao ha atributo do DOM para
  // carregar o callback.
  var pendingConfirm = null;

  function buildConfirmModal() {
    if (document.getElementById('modal-delete')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div id="modal-delete" class="fixed inset-0 z-[60] hidden" role="dialog" aria-modal="true" aria-labelledby="modal-delete-title">' +
        '<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closeConfirm()"></div>' +
        // Mesmo motivo do modal de desfecho: o wrapper nao pode capturar o clique.
        '<div class="pointer-events-none fixed inset-0 flex items-center justify-center p-4">' +
          '<div class="pointer-events-auto relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5">' +
            '<h3 id="modal-delete-title" class="text-lg font-semibold text-slate-900"></h3>' +
            '<p id="modal-delete-message" class="mt-2 text-sm text-slate-600"></p>' +
            '<p class="mt-2 text-sm font-semibold text-rose-600">Essa ação não pode ser desfeita.</p>' +
            '<div class="mt-6 flex justify-end gap-2">' +
              '<button type="button" onclick="closeConfirm()" class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>' +
              '<button type="button" id="modal-delete-confirm" class="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>');
    document.getElementById('modal-delete-confirm').addEventListener('click', runConfirm);
  }

  // Porta unica de confirmacao destrutiva. O chamador so descreve o texto e o
  // que fazer no "sim": backdrop, Esc, ARIA e o vermelho ficam por conta daqui.
  function openConfirm(opts) {
    var o = opts || {};
    buildConfirmModal();
    document.getElementById('modal-delete-title').textContent = o.title || 'Tem certeza?';
    document.getElementById('modal-delete-message').textContent = o.message || '';
    document.getElementById('modal-delete-confirm').textContent = o.confirmLabel || 'Confirmar';
    pendingConfirm = o.onConfirm;
    toggleModal('modal-delete');
  }

  function closeConfirm() {
    pendingConfirm = null;
    var el = document.getElementById('modal-delete');
    if (el) el.classList.add('hidden');
    syncBodyScrollLock();
  }

  async function runConfirm() {
    var action = pendingConfirm;
    closeConfirm();
    if (typeof action === 'function') await action();
  }

  function confirmDelete(id) {
    openConfirm({
      title: 'Excluir esta vaga?',
      message: 'A vaga e todas as anotações dela serão removidas.',
      confirmLabel: 'Excluir vaga',
      onConfirm: function () {
        return fetch('/vagas/' + id, { method: 'DELETE' }).then(function () { location.href = '/'; });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initModals);

  // Esc fecha sem confirmar. Delegado no documento porque o modal nasce depois
  // deste script (que roda no <head>) e some do DOM so ao recarregar.
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeConfirm();
  });

  // Este script roda no <head>, antes do modal existir no DOM — por isso a
  // escuta fica no documento (delegacao) em vez de getElementById direto.
  document.addEventListener('change', function (ev) {
    if (ev.target.id !== 'status') return;
    var block = document.getElementById('closed-reason-block');
    var reason = document.getElementById('closed_reason');
    if (!block) return;
    var closing = ev.target.value === 'closed';
    block.classList.toggle('hidden', !closing);
    if (reason) {
      if (closing) reason.setAttribute('required', 'required');
      else reason.removeAttribute('required');
    }
  });
`;

// Desgaste do card por estagio de aging: 0 ok, 1 warn, 2 cold, 3 frozen — o
// mesmo nivel que o board ja calcula. Regra de proposito: NUNCA cor nova (o
// canal de cor e' do termometro/heat), so textura (gradientes), luz (filter),
// fuligem (box-shadow inset), geometria (rotate/skew) e movimento. Sem
// clip-path: a silhueta continua retangular (rounded-xl + overflow-hidden do
// card ja clipa a textura). Referencia visual: .qwen/tmp/aging-mockup/mockup.html
// (familia .wear-*; a familia .tet-* tem cor e ficou fora, por decisao).
// A textura entra por ::after porque o CSS nao pode inserir filho no card.
const AGING_CSS = `
  .card[data-aging="1"], .card[data-aging="2"], .card[data-aging="3"] {
    transition: filter 950ms ease, box-shadow 950ms ease,
                transform 1300ms cubic-bezier(.22,1,.36,1), opacity 950ms ease,
                border-color 150ms ease, background-color 150ms ease, color 150ms ease;
  }
  .card[data-aging]::after {
    content: ""; position: absolute; inset: -4%; border-radius: inherit;
    pointer-events: none; mix-blend-mode: multiply; opacity: 0;
    transition: opacity 950ms ease, background 1400ms ease;
  }
  /* Estagio 1 — warn: empoeirando */
  .card[data-aging="1"] {
    transform: rotate(.5deg);
    filter: sepia(.22) saturate(.88) brightness(.965) contrast(1.04);
    box-shadow: inset 0 0 26px rgba(15,23,42,.16), inset 4px 0 10px -4px rgba(15,23,42,.16);
  }
  .card[data-aging="1"]::after {
    opacity: .20;
    background:
      radial-gradient(circle 60px at 90% 6%, rgba(87,83,78,.42), transparent 72%),
      radial-gradient(circle 46px at 6% 96%, rgba(87,83,78,.34), transparent 72%),
      repeating-linear-gradient(135deg, rgba(51,65,85,.95) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(45deg, rgba(51,65,85,.65) 0 1px, transparent 1px 6px);
  }
  /* Estagio 2 — cold: encardido e gasto */
  .card[data-aging="2"] {
    --gv-rot: 1deg; --gv-skew: 0deg;
    filter: sepia(.42) saturate(.68) brightness(.905) contrast(1.09);
    transform: rotate(var(--gv-rot)) skew(0deg, var(--gv-skew));
    box-shadow: inset 0 0 46px rgba(15,23,42,.20), inset 7px 0 16px -6px rgba(15,23,42,.22),
                inset 0 -8px 18px -8px rgba(15,23,42,.20);
    animation: gv-settle 1600ms cubic-bezier(.22,1,.36,1) 1 both;
  }
  .card[data-aging="2"]::after {
    opacity: .34;
    background:
      radial-gradient(circle 86px at 88% 8%, rgba(68,64,60,.55), transparent 70%),
      radial-gradient(circle 60px at 10% 92%, rgba(68,64,60,.50), transparent 70%),
      radial-gradient(circle 34px at 46% 100%, rgba(68,64,60,.42), transparent 70%),
      radial-gradient(circle 26px at 70% 22%, rgba(68,64,60,.30), transparent 70%),
      repeating-linear-gradient(135deg, rgba(51,65,85,.95) 0 1px, transparent 1px 2px),
      repeating-linear-gradient(45deg, rgba(51,65,85,.75) 0 1px, transparent 1px 4px),
      radial-gradient(circle 1px at 9px 9px, rgba(87,83,78,.85) 0 1px, transparent 1px);
    background-size: auto, auto, auto, auto, auto, auto, 30px 30px;
  }
  /* Estagio 3 — frozen: fossilizado (deriva lenta da propria textura) */
  .card[data-aging="3"] {
    --gv-rot: 1.4deg; --gv-skew: -.22deg;
    filter: sepia(.60) saturate(.44) brightness(.855) contrast(1.16);
    transform: rotate(var(--gv-rot)) skew(0deg, var(--gv-skew));
    box-shadow: inset 0 0 70px rgba(15,23,42,.30), inset 12px 0 26px -8px rgba(15,23,42,.28),
                inset 0 -14px 26px -10px rgba(15,23,42,.26);
    animation: gv-settle 1600ms cubic-bezier(.22,1,.36,1) 1 both;
  }
  .card[data-aging="3"]::after {
    opacity: .46;
    background:
      radial-gradient(circle 120px at 86% 10%, rgba(41,37,36,.62), transparent 70%),
      radial-gradient(circle 80px at 8% 94%, rgba(41,37,36,.55), transparent 70%),
      radial-gradient(circle 46px at 52% 100%, rgba(41,37,36,.48), transparent 70%),
      radial-gradient(circle 34px at 22% 18%, rgba(41,37,36,.34), transparent 70%),
      radial-gradient(circle 30px at 74% 62%, rgba(41,37,36,.28), transparent 70%),
      repeating-linear-gradient(135deg, rgba(41,37,36,.95) 0 1px, transparent 1px 1.5px),
      repeating-linear-gradient(45deg, rgba(51,65,85,.8) 0 1px, transparent 1px 3px),
      radial-gradient(circle 1.4px at 8px 8px, rgba(41,37,36,.95) 0 1.4px, transparent 1.4px),
      radial-gradient(circle 1px at 20px 22px, rgba(68,64,60,.85) 0 1px, transparent 1px);
    background-size: auto, auto, auto, auto, auto, auto, auto, 24px 24px, 37px 37px;
    animation: gv-drift 34s ease-in-out infinite alternate;
  }
  /* Contraste AA: conforme a fuligem densifica o fundo, as linhas secundarias
     ESCURECEM (nao clareiam) e o titulo ganha relevo claro. O alvo e' a linha
     "Aplicado ..." (text-slate-500 do proprio card): cor declarada vence
     heranca, entao o seletor tem de apontar para ela. O rotulo do aging tem
     classe propria e mantem o peso da fonte, que e' o canal dele. */
  .card[data-aging="2"] h3 { color: rgb(15 23 42); text-shadow: 0 1px 0 rgba(255,255,255,.35); }
  .card[data-aging="3"] h3 { color: rgb(2 6 23); text-shadow: 0 1px 0 rgba(255,255,255,.55); }
  .card[data-aging="2"] .card-footer .text-slate-500 { color: rgb(51 65 85); }
  .card[data-aging="3"] .card-footer .text-slate-500 { color: rgb(30 41 59); font-weight: 600; }
  /* Hover: a poeira respira e o card levanta (o inset volta junto com o lift,
     senao o hover:shadow do Tailwind apagaria a fuligem). */
  .card[data-aging]:hover::after { opacity: .30; }
  .card[data-aging="2"]:hover::after { opacity: .44; }
  .card[data-aging="3"]:hover::after { opacity: .60; }
  .card[data-aging="2"]:hover {
    transform: rotate(.8deg) translateY(-2px);
    box-shadow: inset 0 0 46px rgba(15,23,42,.20), inset 7px 0 16px -6px rgba(15,23,42,.22),
                inset 0 -8px 18px -8px rgba(15,23,42,.20), 0 10px 15px -3px rgba(15,23,42,.12);
  }
  .card[data-aging="3"]:hover {
    transform: rotate(1.1deg) skew(0deg,-.22deg) translateY(-3px);
    box-shadow: inset 0 0 70px rgba(15,23,42,.30), inset 12px 0 26px -8px rgba(15,23,42,.28),
                inset 0 -14px 26px -10px rgba(15,23,42,.26), 0 10px 15px -3px rgba(15,23,42,.14);
  }
  @keyframes gv-drift {
    from { transform: translate3d(0, 0, 0) rotate(0deg); }
    to { transform: translate3d(-16px, -11px, 0) rotate(.6deg); }
  }
  @keyframes gv-settle {
    0% { transform: rotate(calc(var(--gv-rot) * 1.6)) skew(0deg, calc(var(--gv-skew) * 1.4)); }
    60% { transform: rotate(calc(var(--gv-rot) * .82)) skew(0deg, calc(var(--gv-skew) * .82)); }
    100% { transform: rotate(var(--gv-rot)) skew(0deg, var(--gv-skew)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .card[data-aging="1"], .card[data-aging="2"], .card[data-aging="3"],
    .card[data-aging]::after { animation: none !important; transition: none !important; }
    .card[data-aging="2"]:hover, .card[data-aging="3"]:hover { transform: none; }
  }
`;

// CSS critico do primeiro paint. Existe porque o Tailwind entra por CDN e
// compila no browser em runtime: antes dele executar NAO EXISTE CSS nenhum, o
// strip deixa de ser grid e cada card vira um block de largura total — o card
// nasce ocupando a tela (~2500px) e so encolhe para 452px quando o compilador
// termina (medido: ~1,2s de card em largura de tela a cada carga). Mesmo recurso
// e mesma razao do AGING_CSS (CSS a mao por uma impossibilidade do CDN).
// Regra de proposito: so o esqueleto estrutural, nada de cor/sombra/tipografia/
// espacamento — isso o Tailwind aplica depois. Todos os seletores vao em
// :where() para terem especificidade ZERO: quando o CDN compila, qualquer classe
// do Tailwind vence estas regras (inclusive lg:auto-cols-fr e o piso de 240px).
const CRITICAL_CSS = `
  /* Faixa de colunas: sem grid as colunas empilham em largura de tela.
     O track e' ABSOLUTO (nao 1fr): o HTML tem ~900KB e chega ao browser em
     pedacos, entao o primeiro layout pode ver so' 1 das 5 colunas. Track
     fracionario com 1 coluna = a largura inteira — medido: 2487px (1 col),
     1215px (2 cols), 451.8px (5 cols). Isso acontece mesmo com o CDN ativo,
     porque auto-cols-fr do Tailwind tambem e' fracionario; o track absoluto
     ja nasce no tamanho final. O 64px sao os 4 gaps de 16px do board. */
  :where(.grid.grid-flow-col) {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, calc((100% - 64px) / 5));
  }
  /* Item de grid tem min-width:auto, entao uma palavra sem quebra estica a
     coluna; min-width:0 e' o teto real. O max-width e' o guarda do primeiro
     paint, em unidade de VIEWPORT de proposito: porcentagem em item de grid
     resolve contra a area do grid (que e' cheia enquanto faltam colunas), nao
     contra a faixa. max(240px, 20vw) e' >= a largura de repouso da coluna em
     todo breakpoint — 20vw = uma das 5 colunas, o piso 240px e' o do board —,
     entao nunca encolhe o layout assentado; so' impede a coluna de nascer
     larga quando o Tailwind ainda nao distribuiu as 5. */
  :where(.column) { min-width: 0; max-width: max(240px, 20vw); }
  /* Cinto do card: nunca mais largo que a coluna que o contem. */
  :where(.card) { max-width: 100%; }
  /* Fundo do body (bg-slate-50) e margem zero (o preflight do Tailwind tambem
     zera): sem isso a pagina pisca branca com moldura de 8px. */
  :where(body) { background-color: #f8fafc; margin: 0; }
`;

// O CLIENT_SCRIPT roda no browser e não importa ESM, mas a data de "movi hoje"
// tem de seguir a MESMA regra do servidor. Em vez de copiar a regra (que diverge
// no primeiro ajuste), injeta-se a própria função de dates.mjs no head.
const DATES_BOOTSTRAP = `<script>window.todayLocalISO = ${todayLocalISO.toString()};</script>`;

function renderPage(content, inlineScript = '') {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GenVagas — Tracking de Candidaturas</title>
  <style>${CRITICAL_CSS}</style>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${AGING_CSS}</style>
  ${DATES_BOOTSTRAP}
  <script>${CLIENT_SCRIPT}</script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900">
  <!-- Safelist do Tailwind CDN: estes elementos sao invisiveis e existem apenas
       para o compilador gerar CSS de classes que so o JS usa. Sem isso, classe
       aplicada a elemento criado em runtime fica sem estilo (bug real: a linha
       de insercao do drag tinha altura 0 e nao aparecia). -->
  ${TW_SAFELIST}
  <header class="border-b border-slate-200 bg-white">
    <div class="flex items-center justify-between px-6 py-4 lg:px-10">
      <div class="flex items-center gap-4">
        <a href="/" class="text-xl font-bold tracking-tight text-slate-900">
          Gen<span class="text-indigo-600">Vagas</span>
        </a>
      </div>
      <button type="button" onclick="toggleModal('modal-nova-vaga')" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
        Nova vaga
      </button>
    </div>
  </header>
  <main class="px-6 py-8 lg:px-10">
    ${content}
  </main>
  ${inlineScript}
</body>
</html>`;
}

// --- handlers ---

// O modal vive sempre no DOM, escondido por classe. Antes ele só era renderizado
// com ?nova=1 — mas a URL ficava suja e o botão de mover fase faz location.reload(),
// reabrindo o modal a cada arrasto. Estado de UI em query param foi a decisão errada.
function handleBoard(req, res, query) {
  const vagas = getJobs.all();
  sendHtml(res, renderPage(renderBoard(vagas) + renderForm()));
}

function handleList(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getJobs.all()));
}

function handleDetail(req, res, id) {
  const vaga = getJobById.get(id);
  if (!vaga) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Job not found' }));
    return;
  }
  // Navegador pede HTML; fetch do Front pede JSON.
  if ((req.headers.accept || '').includes('text/html')) {
    // O form vai junto porque o botão "Nova vaga" do header é global e só
    // funciona onde o modal existe. Sem ele, na tela de detalhe o botão ficava
    // morto (toggleModal não achava #modal-nova-vaga).
    sendHtml(res, renderPage(renderDetails(vaga) + renderForm()));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(vaga));
}

function handleEditForm(req, res, id) {
  const vaga = getJobById.get(id);
  if (!vaga) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Job not found' }));
    return;
  }
  sendHtml(res, renderPage(
    renderDetails(vaga) + renderForm(vaga),
    '<script>toggleModal("modal-nova-vaga");</script>'
  ));
}

async function handleCreate(req, res) {
  try {
    const job = normalizeJob(await readBody(req));
    const invalid = validateJob(job);
    if (invalid) {
      res.writeHead(invalid.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: invalid.error, ...(invalid.code && { code: invalid.code }) }));
      return;
    }
    // Vaga nova nasce com o relógio de estagnação no dia da candidatura e entra
    // no TOPO da coluna de destino — ela é a mais recente, então as mais velhas
    // vão ficando no fim. Mesmo helper do drag: afterId null = primeiro.
    const targetStatus = job.status || 'candidated';
    const topPosition = positionFor(targetStatus, null);
    createJob.run(
      job.title, job.company, job.applied_at, job.opened_at, targetStatus,
      job.url, job.source, job.location_type,
      job.status_changed_at || job.applied_at,
      job.closed_at, job.closed_reason, topPosition, job.heat
    );
    // 303 See Other: cliente repete o GET em / com o método novo.
    res.writeHead(303, { Location: '/' });
    res.end();
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleMergeUpdate(req, res, id) {
  try {
    const result = persistJob(id, await readBody(req));
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(
      result.error ? { error: result.error, ...(result.code && { code: result.code }) } : { success: true }
    ));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// POST de edição vindo do form HTML (urlencoded) — redireciona em vez de devolver JSON.
async function handleFormUpdate(req, res, id) {
  try {
    const result = persistJob(id, await readBody(req));
    if (result.status !== 200) {
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error }));
      return;
    }
    res.writeHead(303, { Location: '/vagas/' + id });
    res.end();
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

function handleDelete(req, res, id) {
  const result = deleteJob.run(id);
  if (result.changes === 0) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Job not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
}

// --- anotações da vaga ---
// Regras de nota vivem num lugar só: POST e PATCH recusam do mesmo jeito.
function normalizeNote(job) {
  return {
    text: clean(job.text),
    note_date: clean(job.note_date)
  };
}

function validateNote(note) {
  if (!note.text) return { status: 400, error: 'Note text is required' };
  if (!note.note_date || !DATE_RE.test(note.note_date)) {
    return { status: 400, error: 'Invalid note_date (expected YYYY-MM-DD)' };
  }
  return null;
}

// A vaga precisa existir antes de qualquer coisa: sem ela o 404 é sobre o job,
// não sobre a nota (que nem chegou a ser procurada).
function requireJob(res, id) {
  const vaga = getJobById.get(id);
  if (!vaga) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Job not found' }));
    return null;
  }
  return vaga;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function handleNotesList(req, res, id) {
  if (!requireJob(res, id)) return;
  sendJson(res, 200, getNotesByJob.all(id));
}

async function handleNoteCreate(req, res, id) {
  try {
    if (!requireJob(res, id)) return;
    const note = normalizeNote(await readBody(req));
    const invalid = validateNote(note);
    if (invalid) {
      sendJson(res, invalid.status, { error: invalid.error });
      return;
    }
    const { lastInsertRowid } = createNote.run(id, note.note_date, note.text);
    sendJson(res, 201, getNoteById.get(lastInsertRowid));
  } catch (e) {
    sendJson(res, 400, { error: e.message });
  }
}

async function handleNoteUpdate(req, res, id, query, noteId) {
  try {
    if (!requireJob(res, id)) return;
    const existing = getNoteById.get(noteId);
    // Nota de outra vaga responde 404 igual a inexistente: o path é o contrato.
    if (!existing || existing.job_id !== Number(id)) {
      sendJson(res, 404, { error: 'Note not found' });
      return;
    }
    const note = normalizeNote({ ...existing, ...(await readBody(req)) });
    const invalid = validateNote(note);
    if (invalid) {
      sendJson(res, invalid.status, { error: invalid.error });
      return;
    }
    updateNote.run(note.note_date, note.text, noteId);
    sendJson(res, 200, getNoteById.get(noteId));
  } catch (e) {
    sendJson(res, 400, { error: e.message });
  }
}

function handleNoteDelete(req, res, id, query, noteId) {
  if (!requireJob(res, id)) return;
  const existing = getNoteById.get(noteId);
  if (!existing || existing.job_id !== Number(id)) {
    sendJson(res, 404, { error: 'Note not found' });
    return;
  }
  deleteNote.run(noteId, id);
  res.writeHead(204);
  res.end();
}

// --- roteamento ---

const routes = [
  { method: 'GET', pattern: /^\/$/, handler: (req, res, id, query) => handleBoard(req, res, query) },
  { method: 'GET', pattern: /^\/vagas$/, handler: handleList },
  { method: 'POST', pattern: /^\/vagas$/, handler: handleCreate },
  { method: 'GET', pattern: /^\/vagas\/(\d+)\/edit$/, handler: handleEditForm },
  { method: 'GET', pattern: /^\/vagas\/(\d+)\/notes$/, handler: handleNotesList },
  { method: 'POST', pattern: /^\/vagas\/(\d+)\/notes$/, handler: handleNoteCreate },
  { method: 'PATCH', pattern: /^\/vagas\/(\d+)\/notes\/(\d+)$/, handler: handleNoteUpdate },
  { method: 'DELETE', pattern: /^\/vagas\/(\d+)\/notes\/(\d+)$/, handler: handleNoteDelete },
  { method: 'GET', pattern: /^\/vagas\/(\d+)$/, handler: handleDetail },
  { method: 'POST', pattern: /^\/vagas\/(\d+)$/, handler: handleFormUpdate },
  { method: 'PATCH', pattern: /^\/vagas\/(\d+)$/, handler: handleMergeUpdate },
  { method: 'PUT', pattern: /^\/vagas\/(\d+)$/, handler: handleMergeUpdate },
  { method: 'DELETE', pattern: /^\/vagas\/(\d+)$/, handler: handleDelete }
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));

  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
    return;
  }

  const match = url.pathname.match(route.pattern);
  const id = match[1] ? parseInt(match[1], 10) : null;
  // 2º grupo (existe só nas rotas de nota) é o id da nota.
  const noteId = match[2] ? parseInt(match[2], 10) : null;
  route.handler(req, res, id, url.searchParams, noteId);
});

// Sem este handler, porta ocupada derruba o processo com stack trace cru.
// A mensagem de console é para quem roda o servidor (pt-BR); os erros da API
// são para clientes HTTP e seguem a convenção de código em inglês.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} já está em uso. Encerre o processo que a ocupa ou rode com PORT=<outra> .`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  // Mostra QUAL banco esta em uso e quantos registros ele tem. Sem isso e' facil
  // subir apontando pro banco errado (real em vez de dev) sem perceber.
  const total = getJobs.all().length;
  console.log(`GenVagas em http://localhost:${PORT} — banco ${DB_PATH} (${total} vagas)`);
});
