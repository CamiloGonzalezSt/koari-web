// data.js
// Carga el JSON de productos y negocio. Reemplazar data/products.json
// con los datos reales (precios, fotos, categorías) cuando el cliente los entregue.

let DATA = null;

async function cargarDatos() {
  try {
    const res = await fetch('data/products.json?v=5');
    if (!res.ok) throw new Error(`No se pudo cargar el catálogo (${res.status})`);
    DATA = await res.json();
    if (!DATA?.negocio || !Array.isArray(DATA?.categorias)) {
      throw new Error('El catálogo tiene un formato inválido');
    }
    return DATA;
  } catch (err) {
    console.error('Error cargando datos:', err);
    const container = document.getElementById('productos-container');
    if (container) {
      container.innerHTML = '<section class="estado-carga" role="alert"><h2>No pudimos cargar el menú</h2><p>Revisa tu conexión e inténtalo nuevamente.</p><button type="button" onclick="location.reload()">Reintentar</button></section>';
    }
    return null;
  }
}
