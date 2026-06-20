import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizWeb = join(aqui, '../sushinan');
const comoDataUrl = codigo => `data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`;
const codigoPromociones = readFileSync(join(raizWeb, 'js/modules/promociones-programadas.js'), 'utf8');
const promociones = await import(comoDataUrl(codigoPromociones));
const catalogoBase = JSON.parse(readFileSync(join(raizWeb, 'data/products.json'), 'utf8'));

const fechas = [
  ['domingo',   '2026-06-14T16:00:00Z', ['promo-10', 'promo-11']],
  ['lunes',     '2026-06-15T16:00:00Z', ['promo-5', 'promo-7']],
  ['martes',    '2026-06-16T16:00:00Z', ['promo-5', 'promo-7']],
  ['miércoles', '2026-06-17T16:00:00Z', ['promo-5', 'promo-7']],
  ['jueves',    '2026-06-18T16:00:00Z', ['promo-5', 'promo-7']],
  ['viernes',   '2026-06-19T16:00:00Z', ['promo-8', 'promo-nan-60']],
  ['sábado',    '2026-06-20T16:00:00Z', ['promo-8', 'promo-nan-60']]
];

let aserciones = 0;
const verificar = (condicion, mensaje) => {
  aserciones++;
  if (!condicion) throw new Error(mensaje);
};

for (const [nombreDia, iso, idsActivos] of fechas) {
  const data = structuredClone(catalogoBase);
  const preciosAntes = new Map(data.categorias.flatMap(c => c.productos).map(p => [p.id, p.precio]));
  const fecha = new Date(iso);
  verificar(promociones.aplicarPromocionesProgramadas(data, fecha), `${nombreDia}: debía aplicar configuración`);
  const productos = new Map(data.categorias.flatMap(c => c.productos).map(p => [p.id, p]));

  for (const regla of promociones.REGLAS_PROMOCIONES) {
    const producto = productos.get(regla.id);
    const activa = idsActivos.includes(regla.id);
    verificar(producto.promocionProgramada.activa === activa, `${nombreDia}/${regla.id}: estado incorrecto`);
    verificar(producto.precio === (activa ? regla.precioOferta : regla.precioRegular), `${nombreDia}/${regla.id}: precio incorrecto`);
  }

  const idsProgramados = new Set(promociones.REGLAS_PROMOCIONES.map(regla => regla.id));
  data.categorias.flatMap(c => c.productos).forEach(producto => {
    if (!idsProgramados.has(producto.id)) {
      verificar(producto.precio === preciosAntes.get(producto.id), `${nombreDia}/${producto.id}: cambió sin pertenecer a la promoción`);
    }
  });

  verificar(!promociones.aplicarPromocionesProgramadas(data, fecha), `${nombreDia}: repetir no debe producir cambios`);
  console.log(`✓ ${nombreDia}: ${idsActivos.join(', ')} activas`);
}

// A las 02:00 UTC todavía es domingo en Chile: protege el cambio de día por zona horaria.
verificar(promociones.obtenerDiaChile(new Date('2026-06-15T02:00:00Z')) === 0, 'La zona horaria de Chile no fue respetada');

const transicion = structuredClone(catalogoBase);
promociones.aplicarPromocionesProgramadas(transicion, new Date('2026-06-19T16:00:00Z'));
promociones.aplicarPromocionesProgramadas(transicion, new Date('2026-06-21T16:00:00Z'));
const productosTransicion = new Map(transicion.categorias.flatMap(c => c.productos).map(p => [p.id, p]));
verificar(productosTransicion.get('promo-8').precio === 16990, 'Viernes→domingo: Promo 8 no recuperó precio regular');
verificar(productosTransicion.get('promo-nan-60').precio === 16000, 'Viernes→domingo: Promo Nan no recuperó precio regular');
verificar(productosTransicion.get('promo-10').precio === 13170, 'Viernes→domingo: Promo 10 no activó oferta');
verificar(productosTransicion.get('promo-11').precio === 16570, 'Viernes→domingo: Promo 11 no activó oferta');

// Integración del carrito persistido: reemplaza un precio antiguo al cargar y al vencer la oferta.
globalThis.__DATA_PRUEBA = {
  negocio: { catalogo_version: 2 },
  categorias: [{ productos: [{
    id: 'promo-8', disponible: true, precio: 15290,
    promocionProgramada: { activa: true, descuento: 10, precioRegular: 16990, precioOferta: 15290 }
  }] }]
};
const memoria = new Map();
globalThis.localStorage = {
  getItem: clave => memoria.get(clave) ?? null,
  setItem: (clave, valor) => memoria.set(clave, valor),
  removeItem: clave => memoria.delete(clave)
};
globalThis.document = { activeElement: null, dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };

memoria.set('sushinan-carrito', JSON.stringify({
  version: 2,
  expira: Date.now() + 60_000,
  items: { 'promo-8': { producto: { id: 'promo-8', nombre: 'Promo 8', precio: 16990 }, cantidad: 2 } }
}));

const codigoCarrito = readFileSync(join(raizWeb, 'js/cart.js'), 'utf8')
  .replace("import { DATA } from './data.js?v=9';", 'const DATA = globalThis.__DATA_PRUEBA;');
const { carrito } = await import(comoDataUrl(codigoCarrito));
carrito.cargar();
verificar(carrito.items['promo-8'].producto.precio === 15290, 'El carrito no adoptó la oferta activa');
verificar(carrito.getTotalPrecio() === 30580, 'El total del carrito con oferta es incorrecto');

const actual = globalThis.__DATA_PRUEBA.categorias[0].productos[0];
actual.precio = 16990;
actual.promocionProgramada = { ...actual.promocionProgramada, activa: false };
verificar(carrito.sincronizarPrecios(false), 'El carrito no detectó el vencimiento de la oferta');
verificar(carrito.items['promo-8'].producto.precio === 16990, 'El carrito conservó un descuento vencido');
verificar(carrito.getTotalPrecio() === 33980, 'El total regular restaurado es incorrecto');

console.log(`\n${aserciones} comprobaciones completadas sin fallos.`);
