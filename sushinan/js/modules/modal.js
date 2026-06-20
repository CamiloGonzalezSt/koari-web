import { DATA } from '../data.js?v=9';
import { carrito, formatearPrecio } from '../cart.js?v=9';
import { CATEGORIA_TIPO, generarImagenProducto } from '../placeholders.js?v=3';
import { escaparHtml } from './utils.js';
import { mantenerFoco, bloquearScroll, desbloquearScroll } from './utils.js';
import { establecerProductoEnUrl, quitarProductoDeUrl, compartirProducto } from './compartir.js';
import {
  tieneVariaciones, precioCardTexto, productoConVariacion,
  productoConVariacionArma, badgeClase
} from './producto-utils.js';
import { animarCartBtn } from './ui.js';

let modalProductoActual   = null;
let modalVariacionActual  = null;
let armaTuRollIngredientes = [];
let armaTuRollEnvoltura   = null;
let focoAnterior          = null;

export const getModalProductoActual = () => modalProductoActual;

export function refrescarModalAbierto() {
  if (!modalProductoActual) return;
  actualizarPromocionModal(modalProductoActual);
  actualizarModalPrecio();
  renderModalControles(modalProductoActual);
}

export function inicializarModal() {
  document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });
  document.addEventListener('keydown', e => {
    const modal = document.getElementById('modal-overlay');
    if (!modal.classList.contains('activo')) return;
    if (e.key === 'Escape') cerrarModal();
    if (e.key === 'Tab')    mantenerFoco(e, document.getElementById('modal-card'));
  });
  document.getElementById('modal-compartir').addEventListener('click', () => {
    if (modalProductoActual) compartirProducto(modalProductoActual);
  });
}

export function inicializarEnlacesProductos() {
  const id = new URLSearchParams(window.location.search).get('producto');
  if (!id) return;
  const producto = DATA.categorias.flatMap(c => c.productos).find(p => p.id === id);
  if (producto) abrirModal(producto, false);
}

export function abrirModal(producto, actualizarUrl = true) {
  focoAnterior          = document.activeElement;
  modalProductoActual   = producto;
  armaTuRollIngredientes = [];
  armaTuRollEnvoltura   = null;

  if (producto.armaTuRoll || !tieneVariaciones(producto)) {
    modalVariacionActual = null;
  } else if (Array.isArray(producto.variaciones)) {
    modalVariacionActual = producto.variaciones.map(dim => dim.opciones[0]);
  } else {
    modalVariacionActual = producto.variaciones.opciones[0];
  }

  let catDelProducto = null;
  for (const cat of DATA.categorias) {
    if (cat.productos.some(p => p.id === producto.id)) { catDelProducto = cat; break; }
  }
  const tipoIlo  = catDelProducto ? (CATEGORIA_TIPO[catDelProducto.id] || 'platter') : 'platter';
  const srcModal = generarImagenProducto(producto, catDelProducto?.nombre || 'Producto', tipoIlo);

  document.getElementById('modal-img').src              = srcModal;
  document.getElementById('modal-nombre').textContent   = producto.nombre;
  document.getElementById('modal-desc').textContent     = producto.descripcion || '';

  actualizarPromocionModal(producto);

  const requiereConsulta = catDelProducto?.id === 'bebidas' ||
    /\b(bebida|jugo|lata)\b/i.test(`${producto.nombre} ${producto.descripcion || ''}`);
  const avisoDisp = document.getElementById('modal-disponibilidad');
  avisoDisp.hidden    = !requiereConsulta;
  avisoDisp.textContent = requiereConsulta
    ? 'Consulta por WhatsApp la disponibilidad de sabores después de confirmar tu pedido.'
    : '';

  const badge = document.getElementById('modal-badge');
  if (producto.badge) {
    badge.textContent = producto.badge;
    badge.className   = 'modal-badge visible ' + badgeClase(producto.badge);
  } else {
    badge.className = 'modal-badge';
  }

  renderModalVariaciones(producto);
  actualizarModalPrecio();
  renderModalControles(producto);

  const overlay   = document.getElementById('modal-overlay');
  const modalCard = document.getElementById('modal-card');
  overlay.classList.add('activo');
  overlay.setAttribute('aria-hidden', 'false');
  modalCard.classList.remove('animando');
  void modalCard.offsetWidth;
  modalCard.classList.add('animando');
  bloquearScroll();
  document.getElementById('modal-cerrar').focus();
  if (actualizarUrl) establecerProductoEnUrl(producto.id);
}

export function cerrarModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay.classList.contains('activo')) return;
  overlay.classList.remove('activo');
  overlay.setAttribute('aria-hidden', 'true');
  if (!document.getElementById('carrito-panel').classList.contains('abierto'))
    desbloquearScroll();
  modalProductoActual  = null;
  modalVariacionActual = null;
  quitarProductoDeUrl();
  focoAnterior?.focus();
}

export function renderModalControles(producto) {
  const container = document.getElementById('modal-controles');

  if (producto.armaTuRoll) {
    const completo = armaTuRollIngredientes.length === producto.armaTuRoll.maxIngredientes && armaTuRollEnvoltura;
    if (!completo) {
      const faltantes = producto.armaTuRoll.maxIngredientes - armaTuRollIngredientes.length;
      container.innerHTML = `<button class="btn-agregar btn-modal-agregar" disabled>Elige ${faltantes} ingrediente${faltantes !== 1 ? 's' : ''} más</button>`;
      return;
    }
    const item     = productoConVariacionArma(producto, armaTuRollIngredientes, armaTuRollEnvoltura);
    const cantidad = carrito.getCantidad(item.id);
    if (cantidad === 0) {
      container.innerHTML = `<button class="btn-agregar btn-modal-agregar">+ Agregar</button>`;
      container.querySelector('.btn-modal-agregar').addEventListener('click', evento => {
        carrito.agregar(item, evento.currentTarget);
        animarCartBtn();
        renderModalControles(producto);
      });
    } else {
      container.innerHTML = `
        <div class="selector-cantidad">
          <button class="btn-restar" aria-label="Restar">−</button>
          <span>${cantidad}</span>
          <button class="btn-sumar" aria-label="Sumar">+</button>
        </div>`;
      container.querySelector('.btn-restar').addEventListener('click', () => { carrito.quitar(item.id); renderModalControles(producto); });
      container.querySelector('.btn-sumar').addEventListener('click',  evento => { carrito.agregar(item, evento.currentTarget); animarCartBtn(); renderModalControles(producto); });
    }
    return;
  }

  const item     = tieneVariaciones(producto) ? productoConVariacion(producto, modalVariacionActual) : producto;
  const cantidad = carrito.getCantidad(item.id);

  if (cantidad === 0) {
    container.innerHTML = `<button class="btn-agregar btn-modal-agregar">+ Agregar</button>`;
    container.querySelector('.btn-modal-agregar').addEventListener('click', evento => {
      carrito.agregar(item, evento.currentTarget);
      animarCartBtn();
      renderModalControles(producto);
    });
  } else {
    container.innerHTML = `
      <div class="selector-cantidad">
        <button class="btn-restar" aria-label="Restar">−</button>
        <span>${cantidad}</span>
        <button class="btn-sumar" aria-label="Sumar">+</button>
      </div>`;
    container.querySelector('.btn-restar').addEventListener('click', () => { carrito.quitar(item.id); renderModalControles(producto); });
    container.querySelector('.btn-sumar').addEventListener('click',  evento => { carrito.agregar(item, evento.currentTarget); animarCartBtn(); renderModalControles(producto); });
  }
}

// ── Internos ────────────────────────────────────────────────────────────────

function actualizarPromocionModal(producto) {
  const promo = producto.promocionProgramada?.activa ? producto.promocionProgramada : null;
  const promoEl = document.getElementById('modal-promocion');
  promoEl.hidden = !promo;
  promoEl.innerHTML = promo
    ? `<strong>${promo.descuento}% de descuento</strong><span>${escaparHtml(promo.vigencia)}</span>`
    : '';
}

function actualizarModalPrecio() {
  let precio = 0;
  if (modalProductoActual?.armaTuRoll) {
    precio = modalProductoActual.precio;
  } else if (!modalVariacionActual) {
    precio = modalProductoActual?.precio ?? 0;
  } else if (Array.isArray(modalVariacionActual)) {
    precio = modalVariacionActual.reduce((sum, v) => sum + v.precio, 0);
  } else {
    precio = modalVariacionActual.precio;
  }
  document.getElementById('modal-precio').textContent = formatearPrecio(precio);
  const anterior = document.getElementById('modal-precio-anterior');
  const promo = !modalVariacionActual && modalProductoActual?.promocionProgramada?.activa
    ? modalProductoActual.promocionProgramada
    : null;
  anterior.hidden = !promo;
  anterior.textContent = promo ? formatearPrecio(promo.precioRegular) : '';
}

function renderModalVariaciones(producto) {
  const cont = document.getElementById('modal-variaciones');
  if (!cont) return;
  if (!tieneVariaciones(producto)) { cont.innerHTML = ''; cont.style.display = 'none'; return; }
  cont.style.display = '';

  if (producto.armaTuRoll) { renderArmaTuRoll(producto); return; }

  if (!Array.isArray(producto.variaciones)) {
    const v = producto.variaciones;
    cont.innerHTML = `
      <p class="modal-variaciones__label">${escaparHtml(v.etiqueta || 'Opción')}</p>
      <div class="modal-variaciones__opciones">
        ${v.opciones.map((o, i) => `
          <button class="variacion-btn${i === 0 ? ' activa' : ''}" data-i="${i}">
            <span>${escaparHtml(o.nombre)}</span>
            <strong>${formatearPrecio(o.precio)}</strong>
          </button>`).join('')}
      </div>`;
    cont.querySelectorAll('.variacion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cont.querySelectorAll('.variacion-btn').forEach(b => b.classList.remove('activa'));
        btn.classList.add('activa');
        modalVariacionActual = producto.variaciones.opciones[+btn.dataset.i];
        actualizarModalPrecio();
        renderModalControles(producto);
      });
    });
  } else {
    cont.innerHTML = producto.variaciones.map((dim, di) => `
      <div class="modal-variaciones__dimension">
        <p class="modal-variaciones__label">${escaparHtml(dim.etiqueta || `Opción ${di + 1}`)}</p>
        <div class="modal-variaciones__opciones" data-dim="${di}">
          ${dim.opciones.map((o, oi) => `
            <button class="variacion-btn${oi === 0 ? ' activa' : ''}" data-dim="${di}" data-opt="${oi}">
              <span>${escaparHtml(o.nombre)}</span>
              <strong>${o.precio === 0 ? 'Incluido' : formatearPrecio(o.precio)}</strong>
            </button>`).join('')}
        </div>
      </div>`).join('');

    cont.querySelectorAll('.variacion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const di = +btn.dataset.dim;
        const oi = +btn.dataset.opt;
        cont.querySelectorAll(`.variacion-btn[data-dim="${di}"]`).forEach(b => b.classList.remove('activa'));
        btn.classList.add('activa');
        modalVariacionActual[di] = producto.variaciones[di].opciones[oi];
        actualizarModalPrecio();
        renderModalControles(producto);
      });
    });
  }
}

function renderArmaTuRoll(producto) {
  const cont = document.getElementById('modal-variaciones');
  const cfg  = producto.armaTuRoll;
  const max  = cfg.maxIngredientes;

  const renderContador = () => {
    const n = armaTuRollIngredientes.length;
    const el = cont.querySelector('.arma-counter');
    el.textContent = `${n} / ${max} ingredientes`;
    el.className   = 'arma-counter' + (n === max ? ' completo' : '');
  };

  cont.innerHTML = `
    <p class="modal-variaciones__label">Elige ${max} ingredientes</p>
    <p class="arma-counter">0 / ${max} ingredientes</p>
    <div class="arma-ingredientes">
      ${cfg.ingredientes.map(i => `<button class="arma-ingr-btn" data-id="${escaparHtml(i.id)}">${escaparHtml(i.nombre)}</button>`).join('')}
    </div>
    <p class="modal-variaciones__label" style="margin-top:16px">Envoltura</p>
    <div class="modal-variaciones__opciones">
      ${cfg.envolturas.map((e, idx) => `
        <button class="variacion-btn${idx === 0 ? ' activa' : ''}" data-env="${escaparHtml(e.id)}">
          <span>${escaparHtml(e.nombre)}</span>
        </button>`).join('')}
    </div>`;

  armaTuRollEnvoltura = cfg.envolturas[0].id;

  cont.querySelectorAll('.arma-ingr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id;
      const idx = armaTuRollIngredientes.indexOf(id);
      if (idx >= 0) { armaTuRollIngredientes.splice(idx, 1); btn.classList.remove('activa'); }
      else if (armaTuRollIngredientes.length < max) { armaTuRollIngredientes.push(id); btn.classList.add('activa'); }
      renderContador();
      renderModalControles(producto);
    });
  });

  cont.querySelectorAll('.variacion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cont.querySelectorAll('.variacion-btn').forEach(b => b.classList.remove('activa'));
      btn.classList.add('activa');
      armaTuRollEnvoltura = btn.dataset.env;
      renderModalControles(producto);
    });
  });
}
