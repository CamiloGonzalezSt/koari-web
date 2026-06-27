const assert = require('assert/strict');
const handler = require('../api/pedidos.js');

async function llamar(req) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { this.ended = true; return this; }
  };
  await handler({ headers: {}, ...req }, res);
  return res;
}

function pedidoValido(extra = {}) {
  return {
    orderId: 'SN-TEST',
    modalidad: 'Delivery',
    comuna: 'Recoleta',
    pago: 'Efectivo al momento de la entrega',
    subtotal: 11990,
    envio: 1000,
    total: 12990,
    cantidadItems: 1,
    programacion: { tipo: 'lo_antes_posible', fecha: '', hora: '' },
    preferencias: { palillos: '0', sinSoya: false, sinWasabi: false, notaCliente: true },
    items: [{
      id: 'promo-5',
      nombre: 'Promo 5',
      cantidad: 1,
      precioUnitario: 11990,
      total: 11990,
      promocion: {
        activa: true,
        descuento: '20%',
        precioRegular: 14990,
        precioOferta: 11990,
        vigencia: 'Lunes a jueves'
      }
    }],
    ...extra
  };
}

(async () => {
  delete process.env.PEDIDOS_WEBHOOK_URL;
  delete process.env.SUSHINAN_PEDIDOS_WEBHOOK_URL;

  let res = await llamar({ method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.ok, false);

  res = await llamar({ method: 'POST', body: { items: [], total: 0 } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'invalid-order');

  res = await llamar({ method: 'POST', body: pedidoValido() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.skipped, true);

  let capturado = null;
  process.env.PEDIDOS_WEBHOOK_URL = 'https://example.test/webhook';
  process.env.PEDIDOS_WEBHOOK_SECRET = 'secreto-test';
  const fetchOriginal = global.fetch;
  global.fetch = async (url, opciones) => {
    capturado = { url, body: JSON.parse(opciones.body) };
    return { ok: true };
  };

  res = await llamar({
    method: 'POST',
    headers: { referer: 'https://www.sushinan.cl/' },
    body: pedidoValido({
      nombre: 'No debe guardarse',
      telefono: '+56911111111',
      direccion: 'No debe guardarse'
    })
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(capturado.url, 'https://example.test/webhook');
  assert.equal(capturado.body.secret, 'secreto-test');
  assert.equal(capturado.body.pedido.items[0].promocion.precioOferta, 11990);
  assert.equal('nombre' in capturado.body.pedido, false);
  assert.equal('telefono' in capturado.body.pedido, false);
  assert.equal('direccion' in capturado.body.pedido, false);

  global.fetch = fetchOriginal;
  delete process.env.PEDIDOS_WEBHOOK_URL;
  delete process.env.PEDIDOS_WEBHOOK_SECRET;

  console.log('Seguimiento de pedidos: pruebas OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
