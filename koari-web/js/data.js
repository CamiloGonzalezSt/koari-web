// data.js
// Carga el JSON de productos y negocio. Reemplazar data/products.json
// con los datos reales (precios, fotos, categorías) cuando el cliente los entregue.

let DATA = null;

async function cargarDatos() {
  try {
    const res = await fetch('data/products.json?v=4');
    DATA = await res.json();
    return DATA;
  } catch (err) {
    console.error('Error cargando datos:', err);
    return null;
  }
}
