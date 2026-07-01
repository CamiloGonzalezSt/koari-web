// app.js — Orquestador principal. Importa módulos y wirea eventos globales.
import { DATA, cargarDatos } from './data.js?v=9';
import { carrito } from './cart.js?v=9';
import { cargarFavoritos, filtrarProductos, inicializarBusqueda } from './modules/favoritos.js';
import { inicializarMicrointeracciones, inicializarObservadoresVisuales } from './modules/ui.js';
import { inicializarModal, inicializarEnlacesProductos, refrescarModalAbierto } from './modules/modal.js';
import { iniciarRelojPromociones } from './modules/promociones-programadas.js';
import {
  renderHero, renderHeader, renderFooter,
  renderNavCategorias, renderProductos, renderBotonesCantidad
} from './modules/catalogo.js';
import {
  renderCarrito, inicializarEventosCarrito, inicializarComunas,
  inicializarModalidad, inicializarFormularioCliente, inicializarPrivacidad,
  inicializarProgramacionPedido, inicializarUltimoPedido, inicializarPago,
  inicializarBeneficioPrimeraCompra, inicializarConfirmacion, inicializarWspFlotante
} from './modules/checkout.js?v=4';

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
  inicializarBeneficioPrimeraCompra();
  inicializarBusqueda();
  inicializarWspFlotante();
  inicializarModal();
  inicializarMicrointeracciones();
  inicializarObservadoresVisuales();
  inicializarConfirmacion();
  inicializarEnlacesProductos();

  iniciarRelojPromociones(DATA, () => {
    carrito.sincronizarPrecios(false);
    carrito.actualizar();
    renderProductos();
    filtrarProductos(document.getElementById('busqueda-input')?.value.trim().toLowerCase() || '');
    inicializarObservadoresVisuales();
    refrescarModalAbierto();
  });
});
