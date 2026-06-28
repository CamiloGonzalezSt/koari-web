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
  if (!webhookUrl) {
    return res.status(200).json({
      ok: false,
      elegible: false,
      motivo: 'Validación no configurada.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const cliente = normalizarCliente(body.cliente || {});

    if (!cliente.telefono || !cliente.direccionNormalizada || !cliente.comunaNormalizada || !cliente.deviceId) {
      return res.status(400).json({
        ok: false,
        elegible: false,
        motivo: 'Faltan datos para validar el beneficio.'
      });
    }

    const secret = process.env.PEDIDOS_WEBHOOK_SECRET || process.env.SUSHINAN_PEDIDOS_WEBHOOK_SECRET || '';
    const respuesta = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        accion: 'validar_beneficio_primera_compra',
        beneficio: {
          tipo: 'despacho_gratis_primera_compra',
          cliente,
          solicitadoEn: new Date().toISOString()
        }
      })
    });

    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !data.ok) {
      return res.status(200).json({
        ok: false,
        elegible: false,
        motivo: data.motivo || 'No se pudo validar el beneficio.'
      });
    }

    return res.status(200).json({
      ok: true,
      elegible: Boolean(data.elegible),
      token: texto(data.token, 120),
      motivo: texto(data.motivo, 180),
      coincidencias: Array.isArray(data.coincidencias) ? data.coincidencias.map(v => texto(v, 40)).filter(Boolean) : []
    });
  } catch (error) {
    return res.status(400).json({ ok: false, elegible: false, error: 'bad-request' });
  }
};

function normalizarCliente(input) {
  return {
    nombre: texto(input.nombre, 120),
    nombreNormalizado: normalizarTexto(input.nombreNormalizado || input.nombre, 120),
    telefono: telefono(input.telefono),
    direccion: texto(input.direccion, 180),
    direccionNormalizada: normalizarDireccion(input.direccionNormalizada || input.direccion),
    comuna: texto(input.comuna, 80),
    comunaNormalizada: normalizarTexto(input.comunaNormalizada || input.comuna, 80),
    deviceId: texto(input.deviceId, 80)
  };
}

function texto(valor, largo) {
  return String(valor ?? '').trim().slice(0, largo);
}

function telefono(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return /^569\d{8}$/.test(digitos) ? digitos : '';
}

function normalizarTexto(valor, largo = 180) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, largo);
}

function normalizarDireccion(valor) {
  return normalizarTexto(valor)
    .replace(/\bavenida\b/g, 'av')
    .replace(/\bavda\b/g, 'av')
    .replace(/\bpasaje\b/g, 'psje')
    .replace(/\bdepartamento\b/g, 'depto')
    .replace(/\bdpto\b/g, 'depto')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}
