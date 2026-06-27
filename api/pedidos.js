const MAX_ITEMS = 60;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const webhookUrl = process.env.PEDIDOS_WEBHOOK_URL || process.env.SUSHINAN_PEDIDOS_WEBHOOK_URL;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const pedido = normalizarPedido(body, req);

    if (!pedido.items.length || pedido.total <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid-order' });
    }

    if (!webhookUrl) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'webhook-not-configured' });
    }

    const secret = process.env.PEDIDOS_WEBHOOK_SECRET || process.env.SUSHINAN_PEDIDOS_WEBHOOK_SECRET || '';
    const respuesta = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, pedido })
    });

    if (!respuesta.ok) {
      return res.status(502).json({ ok: false, error: 'webhook-failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ ok: false, error: 'bad-request' });
  }
};

function normalizarPedido(input, req) {
  const items = Array.isArray(input.items) ? input.items.slice(0, MAX_ITEMS).map(item => ({
    id: texto(item.id, 100),
    nombre: texto(item.nombre, 160),
    cantidad: entero(item.cantidad),
    precioUnitario: dinero(item.precioUnitario),
    total: dinero(item.total),
    promocion: item.promocion ? {
      activa: Boolean(item.promocion.activa),
      descuento: texto(item.promocion.descuento, 20),
      precioRegular: dinero(item.promocion.precioRegular),
      precioOferta: dinero(item.promocion.precioOferta),
      vigencia: texto(item.promocion.vigencia, 120)
    } : null
  })).filter(item => item.id && item.nombre && item.cantidad > 0) : [];

  return {
    version: 1,
    evento: texto(input.evento, 60) || 'pedido_whatsapp_abierto',
    orderId: texto(input.orderId, 80) || crearIdPedido(),
    recibidoEn: new Date().toISOString(),
    creadoEnCliente: texto(input.creadoEnCliente, 40),
    pagina: texto(input.pagina, 300) || texto(req.headers.referer, 300),
    modalidad: texto(input.modalidad, 30),
    comuna: texto(input.comuna, 80),
    pago: texto(input.pago, 120),
    programacion: {
      tipo: texto(input.programacion?.tipo, 30),
      fecha: texto(input.programacion?.fecha, 20),
      hora: texto(input.programacion?.hora, 10)
    },
    subtotal: dinero(input.subtotal),
    envio: dinero(input.envio),
    total: dinero(input.total),
    cantidadItems: entero(input.cantidadItems) || items.reduce((suma, item) => suma + item.cantidad, 0),
    incluyeBebidas: Boolean(input.incluyeBebidas),
    preferencias: {
      palillos: texto(input.preferencias?.palillos, 20),
      sinSoya: Boolean(input.preferencias?.sinSoya),
      sinWasabi: Boolean(input.preferencias?.sinWasabi),
      notaCliente: Boolean(input.preferencias?.notaCliente)
    },
    items
  };
}

function texto(valor, largo) {
  return String(valor ?? '').trim().slice(0, largo);
}

function dinero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero) : 0;
}

function entero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : 0;
}

function crearIdPedido() {
  return `SN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
