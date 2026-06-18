// Relación entre categorías y su representación visual de respaldo.
export const CATEGORIA_TIPO = {
  promos: 'platter',
  vegetarianas: 'veg',
  'todo-pollo': 'pollo',
  'rolls-carta': 'maki',
  'rolls-sin-arroz': 'maki',
  'veg-roll': 'veg',
  'sushi-burger': 'burger',
  gohan: 'bowl',
  sashimi: 'sashimi',
  hosomaki: 'maki',
  futomaki: 'maki',
  nigiris: 'nigiri',
  gyosas: 'gyoza',
  'hand-roll': 'handroll',
  aperitivos: 'tempura',
  bebidas: 'drink'
};

export function generarImagenProducto(producto) {
  return producto?.imagen || 'img/sushi-demo.webp';
}
