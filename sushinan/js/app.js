// app.js — Orquestador principal. Importa módulos y wirea eventos globales.
import { DATA, cargarDatos } from './data.js?v=8';
import { carrito } from './cart.js?v=8';
import { cargarFavoritos, inicializarBusqueda } from './modules/favoritos.js';
import { inicializarMicrointeracciones, inicializarObservadoresVisuales } from './modules/ui.js';
import { inicializarModal, inicializarEnlacesProductos } from './modules/modal.js';
import {
  renderHero, renderHeader, renderFooter,
  renderNavCategorias, renderProductos, renderBotonesCantidad
} from './modules/catalogo.js';
import {
  renderCarrito, inicializarEventosCarrito, inicializarComunas,
  inicializarModalidad, inicializarFormularioCliente, inicializarPrivacidad,
  inicializarProgramacionPedido, inicializarUltimoPedido, inicializarPago,
  inicializarConfirmacion, inicializarWspFlotante
} from './modules/checkout.js';

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();
  if (!DATA) return;

  carrito.cargar();
  cargarFavoritos();

  document.addEventListener('carrito:actualizado', () => {
    renderCarrito();
    renderBotonesCantidad();
  });

  renderHero();
  renderHeader();
  renderNavCategorias();
  renderProductos();
  renderCarrito();
  renderFooter();

  inicializarComunas();
  inicializarModalidad();
  inicializarFormularioCliente();
  inicializarPrivacidad();
  inicializarProgramacionPedido();
  inicializarEventosCarrito();
  inicializarUltimoPedido();
  inicializarPago();
  inicializarBusqueda();
  inicializarWspFlotante();
  inicializarModal();
  inicializarMicrointeracciones();
  inicializarObservadoresVisuales();
  inicializarConfirmacion();
  inicializarEnlacesProductos();
});
