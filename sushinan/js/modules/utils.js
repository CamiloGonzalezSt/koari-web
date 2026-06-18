export function normalizarTelefono(valor) {
  let digitos = String(valor || '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(digitos)) digitos = `56${digitos}`;
  return /^569\d{8}$/.test(digitos) ? `+${digitos}` : null;
}

export function escaparHtml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function fechaChileISO(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(fecha);
  const valor = tipo => partes.find(parte => parte.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function mantenerFoco(evento, contenedor) {
  const elementos = [...contenedor.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.offsetParent !== null);
  if (!elementos.length) return;
  const primero = elementos[0];
  const ultimo = elementos[elementos.length - 1];
  if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
  else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
}

export function horaChile(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(fecha);
  const valor = tipo => partes.find(parte => parte.type === tipo)?.value;
  return `${valor('hour')}:${valor('minute')}`;
}
