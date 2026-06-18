// cart.js
// Lógica del carrito: estado en memoria (sin localStorage por restricción de artifacts,
// pero en producción real fuera de artifacts SÍ se puede usar localStorage para persistencia).
import { DATA } from './data.js?v=8';

export const carrito = {
  items: {}, // { productoId: { producto, cantidad } }

  cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem('sushinan-carrito') || 'null');
      const versionActual = DATA?.negocio?.catalogo_version || 1;
      if (!guardado || !guardado.expira || guardado.expira <= Date.now() || guardado.version !== versionActual || !guardado.items) {
        localStorage.removeItem('sushinan-carrito');
        return;
      }
      const catalogo = new Map(DATA.categorias.flatMap(c => c.productos).map(p => [p.id, p]));
      this.items = Object.fromEntries(
        Object.entries(guardado.items).filter(([, item]) => {
          const idBase = item?.producto?.id?.split('__')[0];
          const productoActual = catalogo.get(idBase);
          return productoActual && productoActual.disponible !== false &&
            Number.isFinite(item.producto.precio) && Number.isInteger(item.cantidad) &&
            item.cantidad > 0 && item.cantidad <= 99;
        })
      );
    } catch (err) {
      console.warn('No fue posible restaurar el carrito:', err);
      localStorage.removeItem('sushinan-carrito');
    }
  },

  guardar() {
    try {
      localStorage.setItem('sushinan-carrito', JSON.stringify({
        version: DATA?.negocio?.catalogo_version || 1,
        expira: Date.now() + 7 * 86_400_000,
        items: this.items
      }));
    } catch (err) {
      console.warn('No fue posible guardar el carrito:', err);
    }
  },

  agregar(producto, origen = null) {
    document.dispatchEvent(new CustomEvent('carrito:agregado', {
      detail: { producto, origen: origen || document.activeElement }
    }));
    if (this.items[producto.id]) {
      this.items[producto.id].cantidad = Math.min(99, this.items[producto.id].cantidad + 1);
    } else {
      this.items[producto.id] = { producto, cantidad: 1 };
    }
    this.actualizar();
  },

  quitar(productoId) {
    if (!this.items[productoId]) return;
    this.items[productoId].cantidad -= 1;
    if (this.items[productoId].cantidad <= 0) {
      delete this.items[productoId];
    }
    this.actualizar();
  },

  eliminar(productoId) {
    delete this.items[productoId];
    this.actualizar();
  },

  getCantidad(productoId) {
    return this.items[productoId] ? this.items[productoId].cantidad : 0;
  },

  getTotalItems() {
    return Object.values(this.items).reduce((acc, i) => acc + i.cantidad, 0);
  },

  getTotalPrecio() {
    return Object.values(this.items).reduce(
      (acc, i) => acc + i.producto.precio * i.cantidad, 0
    );
  },

  vaciar() {
    this.items = {};
    this.actualizar();
  },

  actualizar() {
    this.guardar();
    document.dispatchEvent(new CustomEvent('carrito:actualizado'));
  }
};

export function formatearPrecio(valor) {
  return '$' + valor.toLocaleString('es-CL');
}
