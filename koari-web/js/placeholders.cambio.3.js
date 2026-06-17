// placeholders.js
// Genera imágenes "ficticias" (SVG) para cada producto según su categoría.
// Cada tarjeta recibe una ilustración temática del tipo de plato + una etiqueta de categoría.
// Se usa como respaldo: si más adelante existe una foto real en producto.imagen, esa tiene prioridad.

// Ilustración por tipo de plato. Cada valor es marcado SVG dibujado en un lienzo
// de 280 x 150 (origen 0,0, comida centrada ~140,75). El generador lo escala, centra
// y le agrega fondo + etiqueta. Las ilustraciones reales se cargan desde ilustraciones.js;
// si falta alguna, se usa _FALLBACK.
const ILUSTRACIONES = {};

// Ilustración de respaldo: 3 piezas de maki sobre una tablita.
const _FALLBACK = `
<g transform="translate(58,8)">
  <ellipse cx="82" cy="120" rx="120" ry="15" fill="#000000" opacity="0.35"/>
  <rect x="0" y="104" width="164" height="20" rx="6" fill="#2e2e2e"/>
  <g>
    <circle cx="30" cy="86" r="30" fill="#24513f"/>
    <circle cx="30" cy="86" r="24" fill="#f5f3ec"/>
    <circle cx="30" cy="86" r="11" fill="#ff8a5b"/>
    <circle cx="25" cy="81" r="4" fill="#ffffff" opacity="0.5"/>
  </g>
  <g>
    <circle cx="82" cy="78" r="33" fill="#24513f"/>
    <circle cx="82" cy="78" r="26" fill="#f5f3ec"/>
    <circle cx="82" cy="78" r="12" fill="#8bc34a"/>
    <circle cx="77" cy="73" r="4" fill="#ffffff" opacity="0.5"/>
  </g>
  <g>
    <circle cx="134" cy="86" r="30" fill="#24513f"/>
    <circle cx="134" cy="86" r="24" fill="#f5f3ec"/>
    <circle cx="134" cy="86" r="11" fill="#ffd54f"/>
    <circle cx="129" cy="81" r="4" fill="#ffffff" opacity="0.5"/>
  </g>
</g>`;

// Mapa: id de categoría -> tipo de ilustración.
const CATEGORIA_TIPO = {
  'promos':          'platter',
  'vegetarianas':    'veg',
  'todo-pollo':      'pollo',
  'rolls-carta':     'maki',
  'rolls-sin-arroz': 'maki',
  'veg-roll':        'veg',
  'sushi-burger':    'burger',
  'gohan':           'bowl',
  'sashimi':         'sashimi',
  'hosomaki':        'maki',
  'futomaki':        'maki',
  'nigiris':         'nigiri',
  'gyosas':          'gyoza',
  'hand-roll':       'handroll',
  'aperitivos':      'tempura',
  'bebidas':         'drink'
};

// Afina el tipo según palabras clave del producto (para variar dentro de una categoría).
function _tipoPorProducto(producto, tipoCategoria) {
  const t = ((producto && (producto.nombre + ' ' + (producto.descripcion || ''))) || '').toLowerCase();
  if (/\bburger\b/.test(t)) return 'burger';
  if (/\bgohan\b|bowl/.test(t)) return 'bowl';
  if (/sashimi/.test(t)) return 'sashimi';
  if (/nigiri/.test(t)) return 'nigiri';
  if (/gyosa|gyoza/.test(t)) return 'gyoza';
  if (/hand\s?roll|temaki/.test(t)) return 'handroll';
  if (/bebida|lata|jugo|agua|score/.test(t)) return 'drink';
  return tipoCategoria;
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Devuelve la imagen demo de sushi para todas las cards (temporal para presentación al cliente).
// Cuando existan fotos reales, restaurar la función SVG o asignar producto.imagen en products.json.
function generarImagenProducto(producto, categoriaNombre, tipo) {
  return 'img/sushi-demo.webp';
}
