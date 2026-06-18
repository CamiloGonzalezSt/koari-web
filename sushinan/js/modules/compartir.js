import { DATA } from '../data.js?v=8';
import { precioCardTexto } from './producto-utils.js';
import { mostrarAvisoSimple } from './ui.js';

export async function compartirProducto(producto) {
  const textoCompartir = construirTextoCompartirProducto(producto, DATA.negocio, precioCardTexto(producto));
  const datos = {
    title: producto.nombre,
    text:  textoCompartir,
    url:   crearUrlProducto(producto.id)
  };
  try {
    if (navigator.share) await navigator.share(datos);
    else {
      await navigator.clipboard.writeText(`${datos.text}\n\n${datos.url}`);
      mostrarAvisoSimple('Información y enlace del producto copiados');
    }
  } catch (err) {
    if (err.name !== 'AbortError') mostrarAvisoSimple('No se pudo compartir el producto');
  }
}

export function establecerProductoEnUrl(productoId) {
  const url = new URL(window.location.href);
  url.searchParams.set('producto', productoId);
  history.replaceState(null, '', url);
}

export function quitarProductoDeUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('producto')) return;
  url.searchParams.delete('producto');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function crearUrlProducto(productoId) {
  const url = new URL(window.location.href);
  url.searchParams.set('producto', productoId);
  return url.href;
}

export function construirTextoCompartirProducto(producto, negocio, precioTexto) {
  const piezas = producto.nombre.match(/(\d+)\s*piezas?/i)?.[1];
  const componentes = (producto.descripcion || '')
    .split('·')
    .map(detalle => detalle.trim())
    .filter(Boolean)
    .map(detalle => `• ${detalle}`)
    .join('\n');
  let texto = `🍱 ${producto.nombre}\n`;
  if (piezas) texto += `📦 Cantidad: ${piezas} piezas\n`;
  if (componentes) texto += `\n🍣 Piezas y rellenos:\n${componentes}\n`;
  texto += `\n💰 Precio: ${precioTexto}\n`;
  texto += `📍 ${negocio.nombre}`;
  return texto;
}
