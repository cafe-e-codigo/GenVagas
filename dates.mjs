// Data LOCAL no formato YYYY-MM-DD. toISOString() é UTC: entre 21h e 23h59
// locais gravava a data de amanhã — o usuário pensa em dia de calendário, não
// em instante.
export function todayLocalISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
