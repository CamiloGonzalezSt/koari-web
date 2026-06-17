// app.js — Renderiza UI a partir de DATA y maneja eventos.

// Estado del pago
let pagoMetodo = 'efectivo';

// Estado Arma tu Roll
let armaTuRollIngredientes = [];
let armaTuRollEnvoltura = null;

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();
  if (!DATA) return;

  renderHero();
  renderHeader();
  renderNavCategorias();
  renderProductos();
  renderCarrito();
  renderFooter();
  inicializarComunas();
  inicializarEventosCarrito();
  inicializarPago();
  inicializarBusqueda();
  inicializarWspFlotante();
  inicializarModal();
});

function renderHero() {
  const n = DATA.negocio;
  document.getElementById('logo-negocio').src  = n.logo;
  document.getElementById('nombre-negocio').textContent  = n.nombre;
  document.getElementById('tagline-negocio').textContent = n.tagline || '';
  document.title = n.nombre + ' — Pedidos Online';
}

function renderHeader() {
  const n = DATA.negocio;
  document.getElementById('header-logo').src   = n.logo;
  document.getElementById('header-nombre').textContent = n.nombre;
  document.getElementById('footer-logo').src   = n.logo;
  document.getElementById('footer-nombre').textContent = n.nombre;
  document.documentElement.style.setProperty('--rojo', n.colorPrincipal);
}

function renderNavCategorias() {
  const nav = document.getElementById('categorias-nav');
  nav.innerHTML = '';
  DATA.categorias.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'categoria-btn' + (i === 0 ? ' activa' : '');
    btn.innerHTML = (cat.icono ? `<span>${cat.icono}</span>` : '') + cat.nombre;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('activa'));
      btn.classList.add('activa');
      centrarBotonNav(nav, btn);
      const sec = document.getElementById('seccion-' + cat.id);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(btn);
  });

  inicializarNavScroll(nav);
}

// Centra horizontalmente el botón activo dentro de la barra de categorías.
function centrarBotonNav(nav, btn) {
  const destino = btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2;
  nav.scrollTo({ left: destino, behavior: 'smooth' });
}

// Hace que la barra de categorías sea cómoda de desplazar:
// rueda del mouse en horizontal + degradados que avisan que hay más.
function inicializarNavScroll(nav) {
  if (!nav || nav.dataset.scrollInit) return;
  nav.dataset.scrollInit = '1';

  const actualizarFades = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle('fade-left', nav.scrollLeft > 4);
    nav.classList.toggle('fade-right', nav.scrollLeft < max - 4);
  };

  // Rueda vertical del mouse -> desplazamiento horizontal (en trackpad horizontal se deja el gesto nativo).
  nav.addEventListener('wheel', (e) => {
    if (nav.scrollWidth <= nav.clientWidth) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    nav.scrollLeft += e.deltaY;
  }, { passive: false });

  nav.addEventListener('scroll', actualizarFades, { passive: true });
  window.addEventListener('resize', actualizarFades);
  window.addEventListener('load', actualizarFades);
  actualizarFades();
}

function renderProductos() {
  const container = document.getElementById('productos-container');
  container.innerHTML = '';
  DATA.categorias.forEach(cat => {
    const seccion = document.createElement('section');
    seccion.className = 'categoria-seccion';
    seccion.id = 'seccion-' + cat.id;

    const header = document.createElement('div');
    header.className = 'categoria-seccion__header';
    header.innerHTML = `
      ${cat.icono ? `<span class="categoria-seccion__icono">${cat.icono}</span>` : ''}
      <h2 class="categoria-seccion__titulo">${cat.nombre}</h2>
      <div class="categoria-seccion__linea"></div>
    `;
    seccion.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'categoria-seccion__grid';
    cat.productos.forEach(p => grid.appendChild(crearCardProducto(p, cat)));
    seccion.appendChild(grid);

    container.appendChild(seccion);
  });
}

// =====================
//  VARIACIONES (rolls cuyo precio depende de la envoltura)
// =====================
function tieneVariaciones(p) {
  if (p.armaTuRoll) return true;
  if (Array.isArray(p.variaciones)) return p.variaciones.length > 0;
  return !!(p.variaciones && p.variaciones.opciones && p.variaciones.opciones.length);
}

function precioMinimo(p) {
  if (!tieneVariaciones(p)) return 0;
  if (p.armaTuRoll) return p.precio;
  if (!Array.isArray(p.variaciones)) {
    return Math.min(...p.variaciones.opciones.map(o => o.precio));
  }
  // Para array: suma el mínimo de cada dimensión
  return p.variaciones.reduce((total, dim) => {
    const minPrecio = Math.min(...dim.opciones.map(o => o.precio));
    return total + minPrecio;
  }, 0);
}

function precioCardTexto(p) {
  if (p.armaTuRoll) return formatearPrecio(p.precio);
  return tieneVariaciones(p) ? `desde ${formatearPrecio(precioMinimo(p))}` : formatearPrecio(p.precio);
}

// Construye un producto concreto a partir de la(s) variación(es) elegida(s).
// El id compuesto hace que cada combinación sea una línea distinta del carrito.
// variacionesSeleccionadas puede ser:
//   - Un objeto simple (estructura antigua): {id, nombre, precio}
//   - Un array (estructura nueva): [{id, nombre, precio}, ...]
function productoConVariacion(p, variacionesSeleccionadas) {
  const variaciones = Array.isArray(variacionesSeleccionadas) ? variacionesSeleccionadas : [variacionesSeleccionadas];
  const idCompuesto = p.id + '__' + variaciones.map(v => v.id).join('__');
  const nombresVar = variaciones.map(v => v.nombre).join(' + ');
  const precioTotal = variaciones.reduce((sum, v) => sum + v.precio, 0);

  return {
    id: idCompuesto,
    nombre: p.nombre + ' — ' + nombresVar,
    descripcion: p.descripcion,
    precio: precioTotal,
    imagen: p.imagen,
    badge: p.badge
  };
}

function crearCardProducto(producto, categoria) {
  const card = document.createElement('div');
  card.className = 'producto-card';
  card.dataset.nombre = (producto.nombre + ' ' + (producto.descripcion || '')).toLowerCase();

  // Siempre mostramos un badge: el del producto o el nombre de la categoría.
  const badgeTexto = producto.badge || categoria.nombre;
  const badgeHTML = `<span class="producto-card__badge ${badgeClase(badgeTexto)}">${badgeTexto}</span>`;

  // Genera una ilustración SVG según la categoría del producto.
  const tipoIlo = CATEGORIA_TIPO[categoria.id] || 'platter';
  const srcImg = generarImagenProducto(producto, categoria.nombre, tipoIlo);

  card.innerHTML = `
    <div class="producto-card__img-wrap">
      <img src="${srcImg}"
           alt="${producto.nombre}"
           class="producto-card__img"
           loading="lazy">
      ${badgeHTML}
    </div>
    <div class="producto-card__info">
      <div class="producto-card__nombre">${producto.nombre}</div>
      ${producto.descripcion ? `<div class="producto-card__desc">${producto.descripcion}</div>` : ''}
      <div class="producto-card__bottom">
        <span class="producto-card__precio">${precioCardTexto(producto)}</span>
        <div class="controles-${producto.id}"></div>
      </div>
    </div>
  `;

  renderControlProducto(card.querySelector(`.controles-${producto.id}`), producto);

  // Abrir modal al hacer click en la card (pero no en los botones)
  card.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    abrirModal(producto);
  });

  return card;
}

function badgeClase(badge) {
  if (!badge) return '';
  const b = badge.toLowerCase();
  if (b.includes('popular'))                    return 'producto-card__badge--popular';
  if (b.includes('vip'))                        return 'producto-card__badge--vip';
  if (b.includes('pedido'))                     return 'producto-card__badge--mas';
  if (b.includes('nuevo'))                      return 'producto-card__badge--nuevo';
  if (b.includes('picante'))                    return 'producto-card__badge--picante';
  if (b.includes('caliente'))                   return 'producto-card__badge--caliente';
  if (b.includes('vegetariano') || b.includes('veg')) return 'producto-card__badge--vegetariano';
  if (b.includes('especial'))                   return 'producto-card__badge--especial';
  if (b.includes('bebida'))                     return 'producto-card__badge--bebida';
  if (b.includes('lunes'))                      return 'producto-card__badge--lunes';
  if (b.includes('pollo'))                      return 'producto-card__badge--pollo';
  if (b.includes('ofert'))                      return 'producto-card__badge--ofertn';
  return 'producto-card__badge--popular';
}

function renderControlProducto(container, producto) {
  if (tieneVariaciones(producto)) {
    container.innerHTML = `<button class="btn-agregar btn-elegir" data-id="${producto.id}">Elegir</button>`;
    container.querySelector('.btn-elegir').addEventListener('click', () => abrirModal(producto));
    return;
  }
  const cantidad = carrito.getCantidad(producto.id);
  if (cantidad === 0) {
    container.innerHTML = `<button class="btn-agregar" data-id="${producto.id}">+ Agregar</button>`;
    container.querySelector('.btn-agregar').addEventListener('click', () => {
      carrito.agregar(producto);
      animarCartBtn();
    });
  } else {
    container.innerHTML = `
      <div class="selector-cantidad">
        <button class="btn-restar" data-id="${producto.id}" aria-label="Restar">−</button>
        <span>${cantidad}</span>
        <button class="btn-sumar" data-id="${producto.id}" aria-label="Sumar">+</button>
      </div>`;
    container.querySelector('.btn-restar').addEventListener('click', () => carrito.quitar(producto.id));
    container.querySelector('.btn-sumar').addEventListener('click', () => { carrito.agregar(producto); animarCartBtn(); });
  }
}

function animarCartBtn() {
  const btn = document.getElementById('cart-toggle');
  btn.classList.remove('bouncing');
  void btn.offsetWidth;
  btn.classList.add('bouncing');
}

function renderBotonesCantidad() {
  DATA.categorias.forEach(cat => {
    cat.productos.forEach(p => {
      const el = document.querySelector(`.controles-${p.id}`);
      if (el) renderControlProducto(el, p);
    });
  });
  document.getElementById('cart-count').textContent = carrito.getTotalItems();
  if (modalProductoActual) renderModalControles(modalProductoActual);
}

function renderCarrito() {
  const itemsContainer = document.getElementById('carrito-items');
  const totalEl        = document.getElementById('carrito-total');
  const btnPedir       = document.getElementById('btn-pedir-whatsapp');
  const entries        = Object.values(carrito.items);

  document.getElementById('cart-count').textContent = carrito.getTotalItems();

  if (entries.length === 0) {
    itemsContainer.innerHTML = `
      <div class="carrito__vacio">
        <span class="carrito__vacio-icono">🍣</span>
        <p>Tu pedido está vacío</p>
        <span>Agrega algo delicioso</span>
      </div>`;
    totalEl.textContent = formatearPrecio(0);
    btnPedir.disabled = true;
    return;
  }

  itemsContainer.innerHTML = '';
  entries.forEach(({ producto, cantidad }) => {
    const item = document.createElement('div');
    item.className = 'carrito-item';
    item.innerHTML = `
      <div class="carrito-item__info">
        <div class="carrito-item__nombre">${producto.nombre} ×${cantidad}</div>
        <div class="carrito-item__precio">${formatearPrecio(producto.precio * cantidad)}</div>
      </div>
      <button class="carrito-item__quitar" data-id="${producto.id}">Quitar</button>`;
    item.querySelector('.carrito-item__quitar').addEventListener('click', () => carrito.eliminar(producto.id));
    itemsContainer.appendChild(item);
  });

  totalEl.textContent = formatearPrecio(carrito.getTotalPrecio());
  btnPedir.disabled = false;
}

function inicializarEventosCarrito() {
  const panel   = document.getElementById('carrito-panel');
  const overlay = document.getElementById('overlay');

  document.getElementById('cart-toggle').addEventListener('click', () => {
    panel.classList.add('abierto');
    overlay.classList.add('activo');
  });
  document.getElementById('cart-close').addEventListener('click', cerrarCarrito);
  overlay.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-pedir-whatsapp').addEventListener('click', enviarPedidoWhatsapp);

  function cerrarCarrito() {
    panel.classList.remove('abierto');
    overlay.classList.remove('activo');
  }
}

// =====================
//  MODAL PRODUCTO
// =====================
let modalProductoActual = null;
let modalVariacionActual = null;

function inicializarModal() {
  document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModal();
  });
}

function abrirModal(producto) {
  modalProductoActual = producto;
  armaTuRollIngredientes = [];
  armaTuRollEnvoltura = null;

  // Inicializar modalVariacionActual según la estructura
  if (producto.armaTuRoll || !tieneVariaciones(producto)) {
    modalVariacionActual = null;
  } else if (Array.isArray(producto.variaciones)) {
    // Estructura nueva: array de dimensiones. Selecciona el primer elemento de cada dimensión
    modalVariacionActual = producto.variaciones.map(dim => dim.opciones[0]);
  } else {
    // Estructura antigua: un solo objeto con opciones
    modalVariacionActual = producto.variaciones.opciones[0];
  }

  // Encuentra la categoría del producto para generar su ilustración.
  let catDelProducto = null;
  for (const cat of DATA.categorias) {
    if (cat.productos.some(p => p.id === producto.id)) {
      catDelProducto = cat;
      break;
    }
  }
  const tipoIlo = catDelProducto ? (CATEGORIA_TIPO[catDelProducto.id] || 'platter') : 'platter';
  const srcModal = generarImagenProducto(producto, catDelProducto ? catDelProducto.nombre : 'Producto', tipoIlo);
  document.getElementById('modal-img').src = srcModal;
  document.getElementById('modal-nombre').textContent = producto.nombre;
  document.getElementById('modal-desc').textContent = producto.descripcion || '';

  const badge = document.getElementById('modal-badge');
  if (producto.badge) {
    badge.textContent = producto.badge;
    badge.className = 'modal-badge visible ' + badgeClase(producto.badge);
  } else {
    badge.className = 'modal-badge';
  }

  renderModalVariaciones(producto);
  actualizarModalPrecio();
  renderModalControles(producto);

  document.getElementById('modal-overlay').classList.add('activo');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.remove('activo');
  document.body.style.overflow = '';
  modalProductoActual = null;
  modalVariacionActual = null;
}

function actualizarModalPrecio() {
  let precio = 0;
  if (modalProductoActual && modalProductoActual.armaTuRoll) {
    precio = modalProductoActual.precio;
  } else if (!modalVariacionActual) {
    precio = modalProductoActual ? modalProductoActual.precio : 0;
  } else if (Array.isArray(modalVariacionActual)) {
    // Estructura nueva: suma los precios de todas las dimensiones
    precio = modalVariacionActual.reduce((sum, v) => sum + v.precio, 0);
  } else {
    // Estructura antigua: precio único
    precio = modalVariacionActual.precio;
  }
  document.getElementById('modal-precio').textContent = formatearPrecio(precio);
}

function renderArmaTuRoll(producto) {
  const cont = document.getElementById('modal-variaciones');
  const cfg = producto.armaTuRoll;
  const max = cfg.maxIngredientes;

  const renderContador = () => {
    const n = armaTuRollIngredientes.length;
    cont.querySelector('.arma-counter').textContent = `${n} / ${max} ingredientes`;
    cont.querySelector('.arma-counter').className = 'arma-counter' + (n === max ? ' completo' : '');
  };

  cont.innerHTML = `
    <p class="modal-variaciones__label">Elige ${max} ingredientes</p>
    <p class="arma-counter">0 / ${max} ingredientes</p>
    <div class="arma-ingredientes">
      ${cfg.ingredientes.map(i => `
        <button class="arma-ingr-btn" data-id="${i.id}">${i.nombre}</button>
      `).join('')}
    </div>
    <p class="modal-variaciones__label" style="margin-top:16px">Envoltura</p>
    <div class="modal-variaciones__opciones">
      ${cfg.envolturas.map((e, idx) => `
        <button class="variacion-btn${idx === 0 ? ' activa' : ''}" data-env="${e.id}">
          <span>${e.nombre}</span>
        </button>
      `).join('')}
    </div>`;

  // Inicializar envoltura por defecto
  armaTuRollEnvoltura = cfg.envolturas[0].id;

  cont.querySelectorAll('.arma-ingr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const idx = armaTuRollIngredientes.indexOf(id);
      if (idx >= 0) {
        armaTuRollIngredientes.splice(idx, 1);
        btn.classList.remove('activa');
      } else if (armaTuRollIngredientes.length < max) {
        armaTuRollIngredientes.push(id);
        btn.classList.add('activa');
      }
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

function renderModalVariaciones(producto) {
  const cont = document.getElementById('modal-variaciones');
  if (!cont) return;
  if (!tieneVariaciones(producto)) {
    cont.innerHTML = '';
    cont.style.display = 'none';
    return;
  }
  cont.style.display = '';

  if (producto.armaTuRoll) {
    renderArmaTuRoll(producto);
    return;
  }

  if (!Array.isArray(producto.variaciones)) {
    // ESTRUCTURA ANTIGUA: un solo objeto con opciones
    const v = producto.variaciones;
    cont.innerHTML = `
      <p class="modal-variaciones__label">${v.etiqueta || 'Opción'}</p>
      <div class="modal-variaciones__opciones">
        ${v.opciones.map((o, i) => `
          <button class="variacion-btn${i === 0 ? ' activa' : ''}" data-i="${i}">
            <span>${o.nombre}</span>
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
    // ESTRUCTURA NUEVA: array de dimensiones
    cont.innerHTML = producto.variaciones.map((dimension, dimIndex) => `
      <div class="modal-variaciones__dimension">
        <p class="modal-variaciones__label">${dimension.etiqueta || `Opción ${dimIndex + 1}`}</p>
        <div class="modal-variaciones__opciones" data-dim="${dimIndex}">
          ${dimension.opciones.map((o, optIndex) => `
            <button class="variacion-btn${optIndex === 0 ? ' activa' : ''}" data-dim="${dimIndex}" data-opt="${optIndex}">
              <span>${o.nombre}</span>
              <strong>${o.precio === 0 ? 'Incluido' : formatearPrecio(o.precio)}</strong>
            </button>`).join('')}
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('.variacion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dimIndex = +btn.dataset.dim;
        const optIndex = +btn.dataset.opt;

        // Deseleccionar otros botones en la misma dimensión
        cont.querySelectorAll(`.variacion-btn[data-dim="${dimIndex}"]`).forEach(b => b.classList.remove('activa'));
        btn.classList.add('activa');

        // Actualizar modalVariacionActual (array)
        modalVariacionActual[dimIndex] = producto.variaciones[dimIndex].opciones[optIndex];

        actualizarModalPrecio();
        renderModalControles(producto);
      });
    });
  }
}

function productoConVariacionArma(producto) {
  const cfg = producto.armaTuRoll;
  const nombres = armaTuRollIngredientes.map(id => cfg.ingredientes.find(i => i.id === id)?.nombre || id);
  const envObj = cfg.envolturas.find(e => e.id === armaTuRollEnvoltura);
  const idCompuesto = producto.id + '__' + armaTuRollIngredientes.join('__') + '__' + armaTuRollEnvoltura;
  return {
    id: idCompuesto,
    nombre: producto.nombre + ' — ' + nombres.join(', ') + ' · ' + (envObj?.nombre || armaTuRollEnvoltura),
    descripcion: producto.descripcion,
    precio: producto.precio,
    imagen: producto.imagen,
    badge: producto.badge
  };
}

function renderModalControles(producto) {
  const container = document.getElementById('modal-controles');

  if (producto.armaTuRoll) {
    const completo = armaTuRollIngredientes.length === producto.armaTuRoll.maxIngredientes && armaTuRollEnvoltura;
    if (!completo) {
      const faltantes = producto.armaTuRoll.maxIngredientes - armaTuRollIngredientes.length;
      container.innerHTML = `<button class="btn-agregar btn-modal-agregar" disabled>Elige ${faltantes} ingrediente${faltantes !== 1 ? 's' : ''} más</button>`;
      return;
    }
    const item = productoConVariacionArma(producto);
    const cantidad = carrito.getCantidad(item.id);
    if (cantidad === 0) {
      container.innerHTML = `<button class="btn-agregar btn-modal-agregar">+ Agregar</button>`;
      container.querySelector('.btn-modal-agregar').addEventListener('click', () => {
        carrito.agregar(item);
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
      container.querySelector('.btn-sumar').addEventListener('click', () => { carrito.agregar(item); animarCartBtn(); renderModalControles(producto); });
    }
    return;
  }

  // Para productos con variación, el item del carrito incluye todas las variaciones elegidas.
  const item = tieneVariaciones(producto)
    ? productoConVariacion(producto, modalVariacionActual)
    : producto;
  const cantidad = carrito.getCantidad(item.id);

  if (cantidad === 0) {
    container.innerHTML = `<button class="btn-agregar btn-modal-agregar">+ Agregar</button>`;
    container.querySelector('.btn-modal-agregar').addEventListener('click', () => {
      carrito.agregar(item);
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
    container.querySelector('.btn-restar').addEventListener('click', () => {
      carrito.quitar(item.id);
      renderModalControles(producto);
    });
    container.querySelector('.btn-sumar').addEventListener('click', () => {
      carrito.agregar(item);
      animarCartBtn();
      renderModalControles(producto);
    });
  }
}

// =====================
//  FOOTER
// =====================
function renderFooter() {
  const n = DATA.negocio;
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
  setSpan('footer-horario',   n.horario || '');

  const ig = document.getElementById('footer-instagram');
  const fb = document.getElementById('footer-facebook');
  if (ig && n.instagram) ig.href = n.instagram;
  if (fb && n.facebook)  fb.href = n.facebook;

  const fn = document.getElementById('footer-nombre');
  const ft = document.getElementById('footer-tagline');
  if (fn) fn.textContent = n.nombre;
  if (ft) ft.textContent = n.tagline || '';
}

// =====================
//  BÚSQUEDA
// =====================
function inicializarBusqueda() {
  const input   = document.getElementById('busqueda-input');
  const limpiar = document.getElementById('busqueda-limpiar');
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
}

function filtrarProductos(q) {
  document.querySelectorAll('.categoria-seccion').forEach(sec => {
    let visibles = 0;
    sec.querySelectorAll('.producto-card').forEach(card => {
      const match = !q || card.dataset.nombre.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visibles++;
    });
    sec.style.display = visibles > 0 ? '' : 'none';
  });
}

// =====================
//  BOTÓN FLOTANTE WA
// =====================
function inicializarWspFlotante() {
  const btn = document.getElementById('wsp-flotante');
  if (!btn || !DATA.negocio.telefono_whatsapp) return;
  btn.href = `https://wa.me/${DATA.negocio.telefono_whatsapp}`;
}

// =====================
//  PAGO
// =====================
//  COMUNAS
// =====================
function inicializarComunas() {
  const sel = document.getElementById('cliente-comuna');
  if (!sel || !DATA.negocio.zonas_cobertura) return;
  const comunas = DATA.negocio.zonas_cobertura.split(',').map(c => c.trim()).filter(Boolean);
  comunas.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

// =====================
function inicializarPago() {
  renderDatosTransferencia();

  document.querySelectorAll('.pago-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pagoMetodo = btn.dataset.metodo;
      document.querySelectorAll('.pago-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      actualizarPanelPago();
    });
  });
}

function renderDatosTransferencia() {
  const datos = DATA.negocio.pago_transferencia;
  if (!datos) return;
  const container = document.getElementById('transferencia-datos');
  if (!container) return;

  const filas = [
    { label: 'Banco',    valor: datos.banco,          copiable: false },
    { label: 'Tipo',     valor: datos.tipo_cuenta,    copiable: false },
    { label: 'Número',   valor: datos.numero_cuenta,  copiable: true  },
    { label: 'Titular',  valor: datos.titular,        copiable: false },
    { label: 'RUT',      valor: datos.rut,            copiable: true  },
    { label: 'Email',    valor: datos.email,          copiable: true  },
  ];

  container.innerHTML = filas.map(f => `
    <div class="dato-row ${f.copiable ? 'copiable' : ''}" ${f.copiable ? `data-valor="${f.valor}"` : ''}>
      <span>${f.label}</span>
      <strong>${f.valor}</strong>
    </div>`
  ).join('');

  container.querySelectorAll('.copiable').forEach(row => {
    row.addEventListener('click', () => {
      navigator.clipboard.writeText(row.dataset.valor).then(() => {
        row.classList.add('copiado');
        setTimeout(() => row.classList.remove('copiado'), 1800);
      }).catch(() => {});
    });
  });
}

function actualizarPanelPago() {
  const panel = document.getElementById('transferencia-panel');
  if (pagoMetodo === 'transferencia') {
    panel.classList.add('visible');
  } else {
    panel.classList.remove('visible');
  }
}

// =====================
//  WHATSAPP MESSAGE
// =====================
function enviarPedidoWhatsapp() {
  const entries = Object.values(carrito.items);
  if (entries.length === 0) return;

  // Leer y validar datos del cliente
  const nombre    = document.getElementById('cliente-nombre').value.trim();
  const telefono  = document.getElementById('cliente-telefono').value.trim();
  const direccion = document.getElementById('cliente-direccion').value.trim();
  const comuna    = document.getElementById('cliente-comuna').value.trim();
  const nota      = document.getElementById('cliente-nota').value.trim();

  let hayError = false;
  [['cliente-nombre', nombre], ['cliente-telefono', telefono], ['cliente-direccion', direccion], ['cliente-comuna', comuna]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!val) { el.classList.add('campo-error'); hayError = true; }
    else       el.classList.remove('campo-error');
  });
  if (hayError) {
    document.getElementById('cliente-nombre').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const textoPago = {
    efectivo:      'Efectivo al momento de la entrega',
    transferencia: 'Transferencia — envio comprobante por este chat',
    tarjeta:       'Tarjeta al momento de la entrega',
  };

  const C_PROD = 32, C_CANT = 5, C_PRECIO = 10;
  const SEP = '-'.repeat(C_PROD + C_CANT + C_PRECIO + 4);

  function rpad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
  function lpad(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

  function wrapWords(str, maxLen) {
    if (str.length <= maxLen) return [str];
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (next.length <= maxLen) { cur = next; }
      else { if (cur) lines.push(cur); cur = w.length > maxLen ? w.slice(0, maxLen) : w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function fila(nombre, cant, precio) {
    const precioStr = precio !== null ? formatearPrecio(precio) : '';
    const cantStr   = cant   !== null ? String(cant) : '';
    const lineas = wrapWords(nombre, C_PROD);
    return lineas.map((l, i) =>
      rpad(l, C_PROD) + '  ' +
      lpad(i === 0 ? cantStr   : '', C_CANT) + '  ' +
      lpad(i === 0 ? precioStr : '', C_PRECIO)
    ).join('\n');
  }

  const cabecera = rpad('Producto', C_PROD) + '  ' + lpad('Cant.', C_CANT) + '  ' + lpad('Precio', C_PRECIO);
  let filas = '';
  entries.forEach(({ producto, cantidad }) => {
    filas += fila(producto.nombre, cantidad, producto.precio * cantidad) + '\n';
  });
  const totalFila = fila('TOTAL', null, carrito.getTotalPrecio());

  const tabla = '```\n' + cabecera + '\n' + SEP + '\n' + filas + SEP + '\n' + totalFila + '\n```';

  let msg = `NUEVO PEDIDO - Sushi Nan\n\n`;
  msg += tabla + '\n\n';
  msg += `Pago: ${textoPago[pagoMetodo]}\n\n`;
  msg += `DATOS DEL CLIENTE\n`;
  msg += `Nombre:    ${nombre}\n`;
  msg += `Telefono:  ${telefono}\n`;
  msg += `Direccion: ${direccion}, ${comuna}`;
  if (nota) msg += `\nNota:      ${nota}`;

  const url = `https://wa.me/${DATA.negocio.telefono_whatsapp}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
