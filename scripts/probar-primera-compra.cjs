const assert = require('assert/strict');
const validarRoot = require('../api/primera-compra.js');
const validarSitio = require('../sushinan/api/primera-compra.js');
const pedidos = require('../api/pedidos.js');

async function llamar(funcion, req) {
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
  await funcion({ headers: {}, ...req }, res);
  return res;
}

function cliente(extra = {}) {
  return {
    nombre: 'Cliente Test',
    nombreNormalizado: 'cliente test',
    telefono: '56912345678',
    direccion: 'Nueva Recoleta 3632',
    direccionNormalizada: 'nueva recoleta 3632',
    comuna: 'Recoleta',
    comunaNormalizada: 'recoleta',
    deviceId: 'dev-test-123',
    ...extra
  };
}

function pedidoConBeneficio() {
  return {
    orderId: 'SN-BENEFICIO-TEST',
    modalidad: 'Delivery',
    comuna: 'Recoleta',
    pago: 'Efectivo',
    subtotal: 10000,
    envio: 0,
    total: 10000,
    cantidadItems: 1,
    incluyeBebidas: false,
    beneficioPrimeraCompra: {
      aplicado: true,
      tipo: 'despacho_gratis_primera_compra',
      ahorro: 1500,
      token: 'BPC-TEST',
      validadoPor: ['telefono', 'direccion', 'dispositivo'],
      cliente: cliente()
    },
    programacion: { tipo: 'lo_antes_posible', fecha: '', hora: '' },
    preferencias: { palillos: '0', sinSoya: false, sinWasabi: false, notaCliente: false },
    items: [{ id: 'promo-test', nombre: 'Promo Test', cantidad: 1, precioUnitario: 10000, total: 10000 }]
  };
}

(async () => {
  delete process.env.PEDIDOS_WEBHOOK_URL;
  delete process.env.SUSHINAN_PEDIDOS_WEBHOOK_URL;

  let res = await llamar(validarRoot, { method: 'GET' });
  assert.equal(res.statusCode, 405);

  res = await llamar(validarRoot, { method: 'POST', body: { accion: 'validar', cliente: cliente() } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.elegible, false);

  process.env.PEDIDOS_WEBHOOK_URL = 'https://example.test/apps-script';
  process.env.PEDIDOS_WEBHOOK_SECRET = 'secreto-test';
  const fetchOriginal = global.fetch;
  let llamada = null;

  global.fetch = async (url, opciones) => {
    llamada = { url, body: JSON.parse(opciones.body) };
    return { ok: true, json: async () => ({ ok: true, elegible: true, token: 'BPC-OK', coincidencias: [] }) };
  };

  res = await llamar(validarRoot, { method: 'POST', body: { accion: 'validar', cliente: cliente() } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.elegible, true);
  assert.equal(res.body.token, 'BPC-OK');
  assert.equal(llamada.body.accion, 'validar_beneficio_primera_compra');
  assert.equal(llamada.body.beneficio.cliente.telefono, '56912345678');

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, elegible: false, motivo: 'Ya usado', coincidencias: ['telefono'] })
  });
  res = await llamar(validarSitio, { method: 'POST', body: { accion: 'validar', cliente: cliente() } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.elegible, false);
  assert.deepEqual(res.body.coincidencias, ['telefono']);

  global.fetch = async (url, opciones) => {
    llamada = { url, body: JSON.parse(opciones.body) };
    return { ok: true };
  };
  res = await llamar(pedidos, { method: 'POST', body: pedidoConBeneficio() });
  assert.equal(res.statusCode, 200);
  assert.equal(llamada.body.pedido.beneficioPrimeraCompra.aplicado, true);
  assert.equal(llamada.body.pedido.beneficioPrimeraCompra.cliente.telefono, '56912345678');
  assert.equal(llamada.body.pedido.envio, 0);
  assert.equal(llamada.body.pedido.total, 10000);

  global.fetch = fetchOriginal;
  delete process.env.PEDIDOS_WEBHOOK_URL;
  delete process.env.PEDIDOS_WEBHOOK_SECRET;

  console.log('Beneficio primera compra: pruebas OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
