import { formatearPrecio } from '../cart.js?v=9';

export function tieneVariaciones(p) {
  if (p.armaTuRoll) return true;
  if (Array.isArray(p.variaciones)) return p.variaciones.length > 0;
  return !!(p.variaciones?.opciones?.length);
}

export function precioMinimo(p) {
  if (!tieneVariaciones(p)) return 0;
  if (p.armaTuRoll) return p.precio;
  if (!Array.isArray(p.variaciones)) return Math.min(...p.variaciones.opciones.map(o => o.precio));
  return p.variaciones.reduce((total, dim) => total + Math.min(...dim.opciones.map(o => o.precio)), 0);
}

export function precioCardTexto(p) {
  if (p.armaTuRoll) return formatearPrecio(p.precio);
  if (tieneVariaciones(p)) return `desde ${formatearPrecio(precioMinimo(p))}`;
  if (p.precio === 0) return 'Incluido';
  return formatearPrecio(p.precio);
}

export function productoConVariacion(p, variacionesSeleccionadas) {
  const variaciones = Array.isArray(variacionesSeleccionadas) ? variacionesSeleccionadas : [variacionesSeleccionadas];
  return {
    id: p.id + '__' + variaciones.map(v => v.id).join('__'),
    nombre: p.nombre + ' — ' + variaciones.map(v => v.nombre).join(' + '),
    descripcion: p.descripcion,
    precio: variaciones.reduce((sum, v) => sum + v.precio, 0),
    imagen: p.imagen,
    badge: p.badge
  };
}

export function productoConVariacionArma(producto, ingredientes, envoltura) {
  const cfg = producto.armaTuRoll;
  const nombres = ingredientes.map(id => cfg.ingredientes.find(i => i.id === id)?.nombre || id);
  const envObj = cfg.envolturas.find(e => e.id === envoltura);
  return {
    id: producto.id + '__' + ingredientes.join('__') + '__' + envoltura,
    nombre: producto.nombre + ' — ' + nombres.join(', ') + ' · ' + (envObj?.nombre || envoltura),
    descripcion: producto.descripcion,
    precio: producto.precio,
    imagen: producto.imagen,
    badge: producto.badge
  };
}

export function badgeClase(badge) {
  if (!badge) return '';
  const b = badge.toLowerCase();
  if (b.includes('popular'))                          return 'producto-card__badge--popular';
  if (b.includes('vip'))                              return 'producto-card__badge--vip';
  if (b.includes('pedido'))                           return 'producto-card__badge--mas';
  if (b.includes('nuevo'))                            return 'producto-card__badge--nuevo';
  if (b.includes('picante'))                          return 'producto-card__badge--picante';
  if (b.includes('caliente'))                         return 'producto-card__badge--caliente';
  if (b.includes('vegetariano') || b.includes('veg')) return 'producto-card__badge--vegetariano';
  if (b.includes('especial'))                         return 'producto-card__badge--especial';
  if (b.includes('bebida'))                           return 'producto-card__badge--bebida';
  if (b.includes('lunes'))                            return 'producto-card__badge--lunes';
  if (b.includes('pollo'))                            return 'producto-card__badge--pollo';
  if (b.includes('ofert'))                            return 'producto-card__badge--ofertn';
  return 'producto-card__badge--popular';
}
