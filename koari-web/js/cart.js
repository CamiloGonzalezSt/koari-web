// cart.js
// Lógica del carrito: estado en memoria (sin localStorage por restricción de artifacts,
// pero en producción real fuera de artifacts SÍ se puede usar localStorage para persistencia).

const carrito = {
  items: {}, // { productoId: { producto, cantidad } }

  agregar(producto) {
    if (this.items[producto.id]) {
      this.items[producto.id].cantidad += 1;
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
    renderCarrito();
    renderBotonesCantidad();
  }
};

function formatearPrecio(valor) {
  return '$' + valor.toLocaleString('es-CL');
}
