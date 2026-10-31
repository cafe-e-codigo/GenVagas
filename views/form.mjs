/**
 * RenderForm — modal de nova vaga
 * @param {Object|null} vaga — vaga existente para edição, ou null para criação
 * @returns {string} HTML string
 */
export function renderForm(vaga = null) {
  const isEdit = Boolean(vaga && vaga.id);
  const v = vaga || {};
  const title = isEdit ? 'Editar vaga' : 'Nova vaga';
  const action = isEdit ? `/vagas/${v.id}` : '/vagas';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Salvar vaga';
  // Em edicao, o modal foi aberto a partir da tela de detalhe — cancelar tem que
  // devolver o usuario para la. Na criacao, cancelar so fecha o modal (o board
  // ja esta atras dele). O X do canto mantem o comportamento de fechar, porque
  // descarta o formulario; o Cancelar explicito e' o botao de "sair da tela".
  const cancelAction = isEdit ? `location.href='/vagas/${v.id}'` : `toggleModal('modal-nova-vaga')`;

  return `
    <div id="modal-nova-vaga" class="fixed inset-0 z-50 hidden" aria-modal="true" role="dialog">
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="toggleModal('modal-nova-vaga')"></div>
      <!-- O wrapper centraliza o card e cobre o viewport inteiro: sem
           pointer-events-none ele intercepta o clique e o backdrop abaixo nunca
           recebe o evento (fechar clicando fora fica morto). O card reabilita os
           eventos para si. -->
      <div class="pointer-events-none fixed inset-0 flex items-center justify-center p-4">
        <div class="pointer-events-auto relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900">${title}</h3>
            <button type="button" onclick="toggleModal('modal-nova-vaga')" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form id="form-vaga" method="POST" action="${action}" class="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
              ${fieldText('title', 'Título da vaga', v.title, true, 'Ex: Desenvolvedor Frontend')}
              ${fieldText('company', 'Empresa', v.company, true, 'Ex: Nubank')}
            </div>

            <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
              ${fieldDate('applied_at', 'Data da candidatura', v.applied_at, true)}
              ${fieldDate('opened_at', 'Abertura da vaga', v.opened_at, false)}
              ${fieldSelect('status', 'Fase', STATUS_OPTIONS, v.status || 'candidated', true)}
            </div>

            ${fieldUrl('url', 'Link do anúncio', v.url)}

            <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
              ${fieldSelect('source', 'Origem', SOURCE_OPTIONS, v.source, false)}
              ${fieldSelect('location_type', 'Modelo', LOCATION_OPTIONS, v.location_type, false)}
              ${fieldSelect('heat', 'Termômetro', HEAT_OPTIONS, v.heat, false)}
            </div>

            <p class="text-xs text-slate-500">
              O termômetro é sua leitura sobre a chance da vaga — uma vaga aberta há um mês com
              centenas de candidatos nasce fria, mesmo cadastrada hoje. Não confundir com o
              alerta de retorno, que é automático e conta os dias desde o último movimento.
            </p>

            <div id="closed-reason-block" class="${v.status === 'closed' ? '' : 'hidden'} space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p class="text-sm font-semibold text-slate-700">Desfecho (obrigatório para Encerrado)</p>
              <div>
                <label for="closed_reason" class="block text-sm font-semibold text-slate-700">Desfecho</label>
                <div class="relative">
                  <select id="closed_reason" name="closed_reason" ${v.status === 'closed' ? 'required' : ''}
                          class="${SELECT_CLASSES}">
                    <option value="" class="bg-white text-slate-900">—</option>
                    ${CLOSED_REASON_OPTIONS.map(o => option(o, v.closed_reason)).join('')}
                  </select>
                  ${CHEVRON_SVG}
                </div>
                <p class="mt-2 text-xs text-slate-500"><code class="text-slate-600">closed_at</code> é preenchido automaticamente.</p>
              </div>
            </div>
          </form>

          <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button type="button" onclick="${cancelAction}" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" form="form-vaga" class="${BTN_PRIMARY}">${submitLabel}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

const INPUT_CLASSES = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
// O <select> perde a seta nativa (appearance-none) e ganha um chevron proprio,
// senao fica com a seta do sistema, que destoa do resto da UI.
const SELECT_CLASSES = INPUT_CLASSES + ' appearance-none cursor-pointer pr-10';
const CHEVRON_SVG = '<span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></span>';
const BTN_PRIMARY = 'rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500';
const BTN_SECONDARY = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50';

const STATUS_OPTIONS = [
  { value: 'candidated', label: 'Candidatado' },
  { value: 'contacted', label: 'Contato feito' },
  { value: 'interviewing', label: 'Entrevistando' },
  { value: 'offer', label: 'Proposta' },
  { value: 'closed', label: 'Encerrado' }
];

const SOURCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'empresa', label: 'Site da empresa' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'outro', label: 'Outro' }
];

const LOCATION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'remoto', label: 'Remoto' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'presencial', label: 'Presencial' }
];

// Termometro: sua leitura sobre a chance da vaga. Vaga aberta ha 1 mes com 100
// candidatos nasce fria; aberta hoje com poucos candidatos nasce quente.
// Opcional — vazio significa "ainda nao avaliei", nao "morna".
const HEAT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'hot', label: 'Quente' },
  { value: 'warm', label: 'Morna' },
  { value: 'cold', label: 'Fria' }
];

const CLOSED_REASON_OPTIONS = [
  { value: 'hired', label: 'Contratado' },
  { value: 'rejected', label: 'Rejeitado' },
  // Desfechos do import Gupy: a empresa encerrou a vaga, ou congelou o processo.
  { value: 'closed_by_company', label: 'Encerrada pela empresa' },
  { value: 'frozen_by_company', label: 'Congelada pela empresa' },
  { value: 'ghosted', label: 'Sem retorno' },
  { value: 'withdrew', label: 'Desisti' }
];

function fieldText(name, label, value, required, placeholder) {
  return `
    <div>
      <label for="${name}" class="block text-sm font-semibold text-slate-700">${label}${required ? ' <span class="text-rose-600">*</span>' : ''}</label>
      <input id="${name}" name="${name}" type="text" ${required ? 'required' : ''} placeholder="${placeholder || ''}" value="${escapeAttr(value)}"
             class="${INPUT_CLASSES}">
    </div>
  `;
}

function fieldDate(name, label, value, required) {
  return `
    <div>
      <label for="${name}" class="block text-sm font-semibold text-slate-700">${label}${required ? ' <span class="text-rose-600">*</span>' : ''}</label>
      <input id="${name}" name="${name}" type="date" ${required ? 'required' : ''} value="${escapeAttr(value)}"
             class="${INPUT_CLASSES}">
    </div>
  `;
}

function fieldUrl(name, label, value) {
  return `
    <div>
      <label for="${name}" class="block text-sm font-semibold text-slate-700">${label}</label>
      <input id="${name}" name="${name}" type="url" placeholder="https://..." value="${escapeAttr(value)}"
             class="${INPUT_CLASSES}">
    </div>
  `;
}

function fieldSelect(name, label, options, value, required) {
  return `
    <div>
      <label for="${name}" class="block text-sm font-semibold text-slate-700">${label}${required ? ' <span class="text-rose-600">*</span>' : ''}</label>
      <div class="relative">
        <select id="${name}" name="${name}" ${required ? 'required' : ''} class="${SELECT_CLASSES}">
          ${options.map(o => option(o, value)).join('')}
        </select>
        ${CHEVRON_SVG}
      </div>
    </div>
  `;
}

function option(o, selected) {
  const isSelected = o.value === (selected || '') ? ' selected' : '';
  // bg-white no <option> evita o fundo cinza do tema do sistema em alguns SOs.
  return `<option value="${o.value}"${isSelected} class="bg-white text-slate-900">${o.label}</option>`;
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
