import { DATA } from '../data.js?v=8';
import { carrito } from '../cart.js?v=8';
import { CATEGORIA_TIPO, generarImagenProducto } from '../placeholders.js?v=3';
import { escaparHtml } from './utils.js';
import { tieneVariaciones, precioCardTexto, productoConVariacion, badgeClase } from './producto-utils.js';
import { animarCartBtn, centrarBotonNav } from './ui.js';
import { getFavoritos, alternarFavorito } from './favoritos.js';
import { abrirModal, renderModalControles, getModalProductoActual } from './modal.js';
import { compartirProducto } from './compartir.js';

export function renderHero() {
  const n = DATA.negocio;
  document.getElementById('logo-negocio').src         = n.logo;
  document.getElementById('nombre-negocio').textContent = n.nombre;
  document.getElementById('tagline-negocio').textContent = n.tagline || '';
  document.title = n.nombre + ' — Pedidos Online';
}

export function renderHeader() {
  const n = DATA.negocio;
  document.getElementById('header-logo').src          = n.logo;
  document.getElementById('header-nombre').textContent = n.nombre;
  document.getElementById('footer-logo').src          = n.logo;
  document.getElementById('footer-nombre').textContent = n.nombre;
  document.documentElement.style.setProperty('--rojo', n.colorPrincipal);
}

export function renderFooter() {
  const n      = DATA.negocio;
  const setSpan = (id, txt) => {
    const el = document.querySelector(`#${id} span`);
    if (el) el.textContent = txt;
  };
  const modal = n.modalidades ? ` · ${n.modalidades}` : '';
  const zonas = n.zonas_cobertura ? ` · Reparto: ${n.zonas_cobertura}` : '';
  setSpan('footer-direccion', (n.direccion || '') + modal + zonas);
  const tels = Array.isArray(n.telefonos) && n.telefonos.length
    ? n.telefonos.join('  ·  ')
    : (n.telefono_display || n.telefono_whatsapp || '');
  setSpan('footer-telefono', tels);
  setSpan('footer-horario', n.horario || '');

  const ig = document.getElementById('footer-instagram');
  const fb = document.getElementById('footer-facebook');
  if (ig && n.instagram) ig.href = n.instagram;
  if (fb && n.facebook)  fb.href = n.facebook;

  const fn = document.getElementById('footer-nombre');
  const ft = document.getElementById('footer-tagline');
  if (fn) fn.textContent = n.nombre;
  if (ft) ft.textContent = n.tagline || '';
  const year = document.getElementById('footer-year');
  if (year) year.textContent = new Date().getFullYear();
}

export function renderNavCategorias() {
  const nav = document.getElementById('categorias-nav');
  nav.innerHTML = '';
  DATA.categorias.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className        = 'categoria-btn' + (i === 0 ? ' activa' : '');
    btn.dataset.categoria = cat.id;
    btn.setAttribute('aria-pressed', String(i === 0));
    if (cat.icono) {
      const icono = document.createElement('span');
      icono.textContent = cat.icono;
      btn.appendChild(icono);
    }
    btn.append(document.createTextNode(cat.nombre));

    const anticipar = () => priorizarImagenesCategoria(cat.id);
    btn.addEventListener('pointerenter', anticipar, { once: true });
    btn.addEventListener('focus',        anticipar, { once: true });
    btn.addEventListener('touchstart',   anticipar, { once: true, passive: true });
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.categoria-btn').forEach(b => {
        b.classList.remove('activa');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('activa');
      btn.setAttribute('aria-pressed', 'true');
      centrarBotonNav(nav, btn);
      const sec = document.getElementById('seccion-' + cat.id);
      if (sec) { await prepararSaltoCategoria(cat.id); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    nav.appendChild(btn);
  });
  inicializarNavScroll(nav);
}

export function renderProductos() {
  const container = document.getElementById('productos-container');
  container.innerHTML = '';
  DATA.categorias.forEach(cat => {
    const seccion   = document.createElement('section');
    seccion.className = 'categoria-seccion';
    seccion.id        = 'seccion-' + cat.id;

    const header = document.createElement('div');
    header.className = 'categoria-seccion__header';
    header.innerHTML = `
      ${cat.icono ? `<span class="categoria-seccion__icono">${escaparHtml(cat.icono)}</span>` : ''}
      <h2 class="categoria-seccion__titulo">${escaparHtml(cat.nombre)}</h2>
      <div class="categoria-seccion__linea"></div>`;
    seccion.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'categoria-seccion__grid';
    cat.productos.forEach(p => grid.appendChild(crearCardProducto(p, cat)));
    seccion.appendChild(grid);

    container.appendChild(seccion);
  });
}

export function renderControlProducto(container, producto) {
  if (producto.disponible === false) {
    container.innerHTML = '<button class="btn-agregar" disabled>Agotado</button>';
    return;
  }
  if (tieneVariaciones(producto)) {
    container.innerHTML = `<button class="btn-agregar btn-elegir" data-id="${producto.id}">Elegir</button>`;
    container.querySelector('.btn-elegir').addEventListener('click', () => abrirModal(producto));
    return;
  }
  const cantidad = carrito.getCantidad(producto.id);
  if (cantidad === 0) {
    container.innerHTML = `<button class="btn-agregar" data-id="${producto.id}">+ Agregar</button>`;
    container.querySelector('.btn-agregar').addEventListener('click', evento => {
      carrito.agregar(producto, evento.currentTarget);
      animarCartBtn();
    });
  } else {
    container.innerHTML = `
      <div class="selector-cantidad">
        <button class="btn-restar" data-id="${producto.id}" aria-label="Restar">−</button>
        <span>${cantidad}</span>
        <button class="btn-sumar"  data-id="${producto.id}" aria-label="Sumar">+</button>
      </div>`;
    container.querySelector('.btn-restar').addEventListener('click', () => carrito.quitar(producto.id));
    container.querySelector('.btn-sumar').addEventListener('click',  evento => { carrito.agregar(producto, evento.currentTarget); animarCartBtn(); });
  }
}

export function renderBotonesCantidad() {
  DATA.categorias.forEach(cat => {
    cat.productos.forEach(p => {
      const el = document.querySelector(`.controles-${p.id}`);
      if (el) renderControlProducto(el, p);
    });
  });
  document.getElementById('cart-count').textContent = carrito.getTotalItems();
  const actual = getModalProductoActual();
  if (actual) renderModalControles(actual);
}

// ── Internos ────────────────────────────────────────────────────────────────

function crearCardProducto(producto, categoria) {
  const favoritos  = getFavoritos();
  const card       = document.createElement('div');
  card.className   = 'producto-card reveal-pending';
  card.tabIndex    = 0;
  card.setAttribute('role',       'group');
  card.setAttribute('aria-label', `${producto.nombre}. ${producto.descripcion || ''}`.trim());
  if (producto.disponible === false) card.classList.add('agotado');
  card.dataset.id     = producto.id;
  card.dataset.nombre = (producto.nombre + ' ' + (producto.descripcion || '')).toLowerCase();

  const badgeTexto = producto.disponible === false ? 'AGOTADO' : (producto.badge || categoria.nombre);
  const tipoIlo    = CATEGORIA_TIPO[categoria.id] || 'platter';
  const srcImg     = generarImagenProducto(producto, categoria.nombre, tipoIlo);

  card.innerHTML = `
    <div class="producto-card__img-wrap cargando">
      <img src="${escaparHtml(srcImg)}"
           alt="${escaparHtml(producto.nombre)}"
           class="producto-card__img"
           width="600" height="360"
           loading="lazy" decoding="async">
      <span class="producto-card__badge ${badgeClase(badgeTexto)}">${escaparHtml(badgeTexto)}</span>
      <button class="favorito-btn${favoritos.has(producto.id) ? ' activo' : ''}"
              type="button" data-favorito-id="${escaparHtml(producto.id)}"
              aria-label="${favoritos.has(producto.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}"
              aria-pressed="${favoritos.has(producto.id)}">♥</button>
      <button class="compartir-card-btn" type="button"
              aria-label="Compartir ${escaparHtml(producto.nombre)}">↗</button>
    </div>
    <div class="producto-card__info">
      <div class="producto-card__nombre">${escaparHtml(producto.nombre)}</div>
      ${producto.descripcion ? `<div class="producto-card__desc">${escaparHtml(producto.descripcion)}</div>` : ''}
      <div class="producto-card__bottom">
        <span class="producto-card__precio">${precioCardTexto(producto)}</span>
        <div class="controles-${escaparHtml(producto.id)}"></div>
      </div>
    </div>`;

  const imagen = card.querySelector('.producto-card__img');
  const finalizarCarga = () => card.querySelector('.producto-card__img-wrap')?.classList.remove('cargando');
  if (imagen.complete) finalizarCarga();
  else {
    imagen.addEventListener('load',  finalizarCarga, { once: true });
    imagen.addEventListener('error', finalizarCarga, { once: true });
  }

  renderControlProducto(card.querySelector(`.controles-${producto.id}`), producto);

  card.querySelector('.favorito-btn').addEventListener('click', e => {
    e.stopPropagation();
    alternarFavorito(producto.id);
  });
  card.querySelector('.compartir-card-btn').addEventListener('click', e => {
    e.stopPropagation();
    compartirProducto(producto);
  });
  card.addEventListener('click', e => { if (!e.target.closest('button')) abrirModal(producto); });
  card.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
      e.preventDefault();
      abrirModal(producto);
    }
  });

  return card;
}

function priorizarImagenesCategoria(categoriaId) {
  const imagenes = [...document.querySelectorAll(`#seccion-${categoriaId} .producto-card__img`)];
  imagenes.forEach((img, i) => {
    img.loading = 'eager';
    if (i < 4) img.fetchPriority = 'high';
  });
  return imagenes;
}

async function prepararSaltoCategoria(categoriaId) {
  const primeras = priorizarImagenesCategoria(categoriaId).slice(0, 4);
  const cargar   = Promise.allSettled(primeras.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return img.decode ? img.decode() : new Promise(resolve => {
      img.addEventListener('load',  resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
  await Promise.race([cargar, new Promise(r => setTimeout(r, 350))]);
}

function inicializarNavScroll(nav) {
  if (!nav || nav.dataset.scrollInit) return;
  nav.dataset.scrollInit = '1';
  const actualizarFades = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle('fade-left',  nav.scrollLeft > 4);
    nav.classList.toggle('fade-right', nav.scrollLeft < max - 4);
  };
  nav.addEventListener('wheel', e => {
    if (nav.scrollWidth <= nav.clientWidth) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    nav.scrollLeft += e.deltaY;
  }, { passive: false });
  nav.addEventListener('scroll', actualizarFades, { passive: true });
  window.addEventListener('resize', actualizarFades);
  window.addEventListener('load',   actualizarFades);
  actualizarFades();
}
