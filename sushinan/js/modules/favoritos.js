import { DATA } from '../data.js?v=9';
import { mostrarToast } from './ui.js';

let favoritos    = new Set();
let soloFavoritos = false;

export const getFavoritos     = () => favoritos;
export const isSoloFavoritos  = () => soloFavoritos;

export function cargarFavoritos() {
  try {
    const guardados  = JSON.parse(localStorage.getItem('sushinan-favoritos') || '[]');
    const idsValidos = new Set(DATA.categorias.flatMap(c => c.productos).map(p => p.id));
    favoritos = new Set(Array.isArray(guardados) ? guardados.filter(id => idsValidos.has(id)) : []);
  } catch (_) {
    favoritos = new Set();
  }
}

export function guardarFavoritos() {
  try { localStorage.setItem('sushinan-favoritos', JSON.stringify([...favoritos])); } catch (_) {}
}

export function resetFavoritos() {
  favoritos     = new Set();
  soloFavoritos = false;
}

export function alternarFavorito(productoId) {
  const seAgrega = !favoritos.has(productoId);
  if (seAgrega) favoritos.add(productoId);
  else           favoritos.delete(productoId);
  guardarFavoritos();
  actualizarUIFavoritos();
  if (soloFavoritos) {
    const q = document.getElementById('busqueda-input')?.value.trim().toLowerCase() || '';
    filtrarProductos(q);
  }
  const producto = DATA.categorias.flatMap(c => c.productos).find(p => p.id === productoId);
  mostrarToast({
    texto:    seAgrega
      ? `${producto?.nombre || 'Producto'} guardado en favoritos`
      : `${producto?.nombre || 'Producto'} eliminado de favoritos`,
    deshacer: () => alternarFavorito(productoId),
    duracion: 3500
  });
}

export function actualizarUIFavoritos() {
  document.querySelectorAll('[data-favorito-id]').forEach(btn => {
    const activo = favoritos.has(btn.dataset.favoritoId);
    btn.classList.toggle('activo', activo);
    btn.setAttribute('aria-pressed', String(activo));
    btn.setAttribute('aria-label', activo ? 'Quitar de favoritos' : 'Agregar a favoritos');
  });
  const count = document.getElementById('favoritos-count');
  if (count) count.textContent = favoritos.size;
}

export function filtrarProductos(q) {
  let total = 0;
  document.querySelectorAll('.categoria-seccion').forEach(sec => {
    let visibles = 0;
    sec.querySelectorAll('.producto-card').forEach(card => {
      const match = (!q || card.dataset.nombre.includes(q)) &&
                    (!soloFavoritos || favoritos.has(card.dataset.id));
      card.style.display = match ? '' : 'none';
      if (match) visibles++;
    });
    sec.style.display = visibles > 0 ? '' : 'none';
    total += visibles;
  });
  const estado = document.getElementById('busqueda-estado');
  if (estado) estado.textContent = (q || soloFavoritos)
    ? `${total} producto${total === 1 ? '' : 's'} ${soloFavoritos ? 'favorito' : 'encontrado'}${total === 1 ? '' : 's'}`
    : '';
}

export function inicializarBusqueda() {
  const input          = document.getElementById('busqueda-input');
  const limpiar        = document.getElementById('busqueda-limpiar');
  const filtroFavoritos = document.getElementById('favoritos-filtro');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    limpiar.style.display = q ? 'flex' : 'none';
    filtrarProductos(q);
  });

  limpiar.addEventListener('click', () => {
    input.value = '';
    limpiar.style.display = 'none';
    filtrarProductos('');
  });

  filtroFavoritos.addEventListener('click', () => {
    soloFavoritos = !soloFavoritos;
    filtroFavoritos.classList.toggle('activo', soloFavoritos);
    filtroFavoritos.setAttribute('aria-pressed', String(soloFavoritos));
    filtrarProductos(input.value.trim().toLowerCase());
  });

  actualizarUIFavoritos();
}
