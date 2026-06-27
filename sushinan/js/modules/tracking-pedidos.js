const ENDPOINT_PEDIDOS = '/api/pedidos';

export function crearIdPedido() {
  const fecha = new Date();
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(fecha).reduce((acc, parte) => {
    acc[parte.type] = parte.value;
    return acc;
  }, {});

  const base = `${partes.year}${partes.month}${partes.day}-${partes.hour}${partes.minute}${partes.second}`;
  const aleatorio = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `SN-${base}-${aleatorio.toUpperCase()}`;
}

export function enviarPedidoGenerado(payload) {
  if (!payload || !payload.items?.length) return;

  const body = JSON.stringify({
    ...payload,
    evento: 'pedido_whatsapp_abierto',
    creadoEnCliente: new Date().toISOString(),
    pagina: location.href
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT_PEDIDOS, blob)) return;
    }
  } catch (_) {}

  try {
    fetch(ENDPOINT_PEDIDOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit'
    }).catch(() => {});
  } catch (_) {}
}
