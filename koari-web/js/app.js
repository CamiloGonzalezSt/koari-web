// app.js — Renderiza UI a partir de DATA y maneja eventos.

// Estado del pago
let pagoMetodo = 'efectivo';
let modalidadPedido = 'delivery';
let focoAnterior = null;
let toastTimer = null;
let pedidoPendienteUrl = '';
let ultimoTotalRender = null;

// Estado Arma tu Roll
let armaTuRollIngredientes = [];
let armaTuRollEnvoltura = null;

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();
  if (!DATA) return;

  carrito.cargar();

  renderHero();
  renderHeader();
  renderNavCategorias();
  renderProductos();
  renderCarrito();
  renderFooter();
  inicializarComunas();
  inicializarModalidad();
  inicializarFormularioCliente();
  inicializarEventosCarrito();
  inicializarPago();
  inicializarBusqueda();
  inicializarWspFlotante();
  inicializarModal();
  inicializarMicrointeracciones();
  inicializarObservadoresVisuales();
  inicializarConfirmacion();
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
    btn.dataset.categoria = cat.id;
    btn.setAttribute('aria-pressed', String(i === 0));
    btn.innerHTML = (cat.icono ? `<span>${cat.icono}</span>` : '') + cat.nombre;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.categoria-btn').forEach(b => {
        b.classList.remove('activa');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('activa');
      btn.setAttribute('aria-pressed', 'true');
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
  if (tieneVariaciones(p)) return `desde ${formatearPrecio(precioMinimo(p))}`;
  if (p.precio === 0) return 'Incluido';
  return formatearPrecio(p.precio);
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
  card.className = 'producto-card reveal-pending';
  card.tabIndex = 0;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${producto.nombre}. ${producto.descripcion || ''}`.trim());
  if (producto.disponible === false) card.classList.add('agotado');
  card.dataset.nombre = (producto.nombre + ' ' + (producto.descripcion || '')).toLowerCase();

  // Siempre mostramos un badge: el del producto o el nombre de la categoría.
  const badgeTexto = producto.disponible === false ? 'AGOTADO' : (producto.badge || categoria.nombre);
  const badgeHTML = `<span class="producto-card__badge ${badgeClase(badgeTexto)}">${badgeTexto}</span>`;

  // Genera una ilustración SVG según la categoría del producto.
  const tipoIlo = CATEGORIA_TIPO[categoria.id] || 'platter';
  const srcImg = generarImagenProducto(producto, categoria.nombre, tipoIlo);

  card.innerHTML = `
    <div class="producto-card__img-wrap cargando">
      <img src="${srcImg}"
           alt="${producto.nombre}"
           class="producto-card__img"
           width="600" height="360"
           loading="lazy" decoding="async">
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

  const imagen = card.querySelector('.producto-card__img');
  const finalizarCarga = () => card.querySelector('.producto-card__img-wrap')?.classList.remove('cargando');
  if (imagen.complete) finalizarCarga();
  else {
    imagen.addEventListener('load', finalizarCarga, { once: true });
    imagen.addEventListener('error', finalizarCarga, { once: true });
  }

  renderControlProducto(card.querySelector(`.controles-${producto.id}`), producto);

  // Abrir modal al hacer click en la card (pero no en los botones)
  card.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    abrirModal(producto);
  });
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
      e.preventDefault();
      abrirModal(producto);
    }
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
    container.querySelector('.btn-agregar').addEventListener('click', (evento) => {
      carrito.agregar(producto, evento.currentTarget);
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
    container.querySelector('.btn-sumar').addEventListener('click', (evento) => { carrito.agregar(producto, evento.currentTarget); animarCartBtn(); });
  }
}

function animarCartBtn() {
  const btn = document.getElementById('cart-toggle');
  btn.classList.remove('bouncing');
  void btn.offsetWidth;
  btn.classList.add('bouncing');
}

function inicializarMicrointeracciones() {
  document.addEventListener('carrito:agregado', (evento) => {
    const { producto, origen } = evento.detail;
    animarProductoAlCarrito(origen);
    mostrarToastCarrito(producto);
    const cta = document.getElementById('btn-pedir-whatsapp');
    cta.classList.remove('llamada-atencion');
    void cta.offsetWidth;
    cta.classList.add('llamada-atencion');
    setTimeout(() => cta.classList.remove('llamada-atencion'), 900);
  });
}

function animarProductoAlCarrito(origen) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const contenedor = origen?.closest?.('.producto-card, .modal-card');
  const imagen = contenedor?.querySelector('img');
  const destino = document.getElementById('cart-toggle');
  if (!imagen || !destino) return;
  const inicio = imagen.getBoundingClientRect();
  const fin = destino.getBoundingClientRect();
  const clon = imagen.cloneNode();
  clon.className = 'producto-volando';
  const tamano = Math.min(92, Math.max(64, inicio.width * 0.32));
  const izquierda = inicio.left + inicio.width / 2 - tamano / 2;
  const arriba = inicio.top + inicio.height / 2 - tamano / 2;
  Object.assign(clon.style, {
    left: `${izquierda}px`, top: `${arriba}px`,
    width: `${tamano}px`, height: `${tamano}px`
  });
  document.body.appendChild(clon);
  const dx = fin.left + fin.width / 2 - (izquierda + tamano / 2);
  const dy = fin.top + fin.height / 2 - (arriba + tamano / 2);
  clon.style.setProperty('--vuelo-x', `${dx}px`);
  clon.style.setProperty('--vuelo-y', `${dy}px`);
  requestAnimationFrame(() => requestAnimationFrame(() => clon.classList.add('en-vuelo')));
  setTimeout(() => {
    clon.remove();
    destino.classList.remove('impacto');
    void destino.offsetWidth;
    destino.classList.add('impacto');
  }, 720);
}

function mostrarToastCarrito(producto) {
  const toast = document.getElementById('toast-carrito');
  const texto = document.getElementById('toast-carrito-texto');
  const deshacer = document.getElementById('toast-deshacer');
  clearTimeout(toastTimer);
  texto.textContent = `${producto.nombre} agregado`;
  deshacer.onclick = () => {
    carrito.quitar(producto.id);
    toast.classList.remove('visible');
    deshacer.onclick = null;
  };
  toast.classList.remove('visible');
  void toast.offsetWidth;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4200);
}

function inicializarObservadoresVisuales() {
  const cards = document.querySelectorAll('.producto-card');
  if (!('IntersectionObserver' in window)) {
    cards.forEach(card => card.classList.add('revelada'));
    return;
  }

  const observadorCards = new IntersectionObserver((entradas, observer) => {
    entradas.forEach(entrada => {
      if (!entrada.isIntersecting) return;
      entrada.target.style.setProperty('--reveal-delay', `${Math.min(entrada.target.dataset.indice || 0, 5) * 45}ms`);
      entrada.target.classList.add('revelada');
      observer.unobserve(entrada.target);
    });
  }, { threshold: 0.08, rootMargin: '60px 0px' });
  cards.forEach((card, indice) => {
    card.dataset.indice = indice % 6;
    observadorCards.observe(card);
  });

  const nav = document.getElementById('categorias-nav');
  const observadorSecciones = new IntersectionObserver(entradas => {
    const visible = entradas.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const id = visible.target.id.replace('seccion-', '');
    const btn = nav.querySelector(`[data-categoria="${id}"]`);
    if (!btn) return;
    nav.querySelectorAll('.categoria-btn').forEach(b => {
      const activa = b === btn;
      b.classList.toggle('activa', activa);
      b.setAttribute('aria-pressed', String(activa));
    });
    centrarBotonNav(nav, btn);
  }, { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.2, 0.6] });
  document.querySelectorAll('.categoria-seccion').forEach(sec => observadorSecciones.observe(sec));
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
    ultimoTotalRender = 0;
    document.getElementById('carrito-desglose').style.display = 'none';
    document.getElementById('carrito-aviso').textContent = '';
    document.getElementById('btn-vaciar').hidden = true;
    btnPedir.disabled = true;
    return;
  }

  document.getElementById('btn-vaciar').hidden = false;

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
    item.querySelector('.carrito-item__quitar').addEventListener('click', () => {
      item.classList.add('saliendo');
      setTimeout(() => carrito.eliminar(producto.id), 180);
    });
    itemsContainer.appendChild(item);
  });

  const subtotal   = carrito.getTotalPrecio();
  const costoEnvio = getCostoEnvio();
  const desglose   = document.getElementById('carrito-desglose');

  document.getElementById('carrito-subtotal').textContent = formatearPrecio(subtotal);
  document.getElementById('carrito-costo-envio').textContent = modalidadPedido === 'retiro'
    ? 'Sin costo'
    : (document.getElementById('cliente-comuna')?.value ? formatearPrecio(costoEnvio) : 'Por calcular');
  document.getElementById('carrito-comuna-label').textContent = modalidadPedido === 'retiro'
    ? 'retiro'
    : (document.getElementById('cliente-comuna')?.value || 'según comuna');
  desglose.style.display = '';

  const totalActual = subtotal + costoEnvio;
  totalEl.textContent = formatearPrecio(totalActual);
  if (ultimoTotalRender !== null && ultimoTotalRender !== totalActual) {
    totalEl.classList.remove('actualizado');
    void totalEl.offsetWidth;
    totalEl.classList.add('actualizado');
  }
  ultimoTotalRender = totalActual;
  const minimo = Number(DATA.negocio.pedido_minimo) || 0;
  const falta = Math.max(0, minimo - subtotal);
  document.getElementById('carrito-aviso').textContent = falta
    ? `Faltan ${formatearPrecio(falta)} para el pedido mínimo.`
    : (DATA.negocio.tiempo_estimado ? `Tiempo estimado: ${DATA.negocio.tiempo_estimado}.` : '');
  btnPedir.disabled = falta > 0;
}

function inicializarEventosCarrito() {
  const panel   = document.getElementById('carrito-panel');
  const overlay = document.getElementById('overlay');

  const toggle = document.getElementById('cart-toggle');
  toggle.addEventListener('click', () => {
    focoAnterior = document.activeElement;
    panel.classList.add('abierto');
    overlay.classList.add('activo');
    panel.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sin-scroll');
    panel.focus();
  });
  document.getElementById('cart-close').addEventListener('click', cerrarCarrito);
  overlay.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-pedir-whatsapp').addEventListener('click', enviarPedidoWhatsapp);
  document.getElementById('btn-vaciar').addEventListener('click', () => {
    if (window.confirm('¿Quieres vaciar todo el pedido?')) carrito.vaciar();
  });
  document.addEventListener('keydown', (e) => {
    if (!panel.classList.contains('abierto')) return;
    if (document.getElementById('confirmacion-overlay').classList.contains('activo')) return;
    if (e.key === 'Escape') cerrarCarrito();
    if (e.key === 'Tab') mantenerFoco(e, panel);
  });

  function cerrarCarrito() {
    panel.classList.remove('abierto');
    overlay.classList.remove('activo');
    panel.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    if (!document.getElementById('modal-overlay').classList.contains('activo')) document.body.classList.remove('sin-scroll');
    focoAnterior?.focus();
  }
}

function mantenerFoco(evento, contenedor) {
  const elementos = [...contenedor.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);
  if (!elementos.length) return;
  const primero = elementos[0];
  const ultimo = elementos[elementos.length - 1];
  if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
  else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
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
    const modal = document.getElementById('modal-overlay');
    if (!modal.classList.contains('activo')) return;
    if (e.key === 'Escape') cerrarModal();
    if (e.key === 'Tab') mantenerFoco(e, document.getElementById('modal-card'));
  });
}

function abrirModal(producto) {
  focoAnterior = document.activeElement;
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
  const avisoDisponibilidad = document.getElementById('modal-disponibilidad');
  const esBebida = catDelProducto?.id === 'bebidas';
  avisoDisponibilidad.hidden = !esBebida;
  avisoDisponibilidad.textContent = esBebida
    ? 'Consulta por WhatsApp la disponibilidad de sabores después de confirmar tu pedido.'
    : '';

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

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('activo');
  overlay.setAttribute('aria-hidden', 'false');
  const modalCard = document.getElementById('modal-card');
  modalCard.classList.remove('animando');
  void modalCard.offsetWidth;
  modalCard.classList.add('animando');
  document.body.classList.add('sin-scroll');
  document.getElementById('modal-cerrar').focus();
}

function cerrarModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay.classList.contains('activo')) return;
  overlay.classList.remove('activo');
  overlay.setAttribute('aria-hidden', 'true');
  if (!document.getElementById('carrito-panel').classList.contains('abierto')) document.body.classList.remove('sin-scroll');
  modalProductoActual = null;
  modalVariacionActual = null;
  focoAnterior?.focus();
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
      container.querySelector('.btn-modal-agregar').addEventListener('click', (evento) => {
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
      container.querySelector('.btn-sumar').addEventListener('click', (evento) => { carrito.agregar(item, evento.currentTarget); animarCartBtn(); renderModalControles(producto); });
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
    container.querySelector('.btn-modal-agregar').addEventListener('click', (evento) => {
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
    container.querySelector('.btn-restar').addEventListener('click', () => {
      carrito.quitar(item.id);
      renderModalControles(producto);
    });
    container.querySelector('.btn-sumar').addEventListener('click', (evento) => {
      carrito.agregar(item, evento.currentTarget);
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
  const year = document.getElementById('footer-year');
  if (year) year.textContent = new Date().getFullYear();
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
  let total = 0;
  document.querySelectorAll('.categoria-seccion').forEach(sec => {
    let visibles = 0;
    sec.querySelectorAll('.producto-card').forEach(card => {
      const match = !q || card.dataset.nombre.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visibles++;
    });
    sec.style.display = visibles > 0 ? '' : 'none';
    total += visibles;
  });
  const estado = document.getElementById('busqueda-estado');
  if (estado) estado.textContent = q ? `${total} resultado${total === 1 ? '' : 's'} para ${q}` : '';
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
//  COMUNAS Y COSTO ENVÍO
// =====================
function getCostoEnvio() {
  if (modalidadPedido === 'retiro') return 0;
  const sel = document.getElementById('cliente-comuna');
  const comuna = sel?.value?.trim();
  if (!comuna || !DATA.negocio.costos_envio) return 0;
  const subtotal = carrito.getTotalPrecio();
  const gratisDesde = Number(DATA.negocio.envio_gratis_desde) || 0;
  if (gratisDesde > 0 && subtotal >= gratisDesde) return 0;
  return DATA.negocio.costos_envio[comuna] || 0;
}

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
  sel.addEventListener('change', renderCarrito);
}

function inicializarModalidad() {
  document.querySelectorAll('.modalidad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modalidadPedido = btn.dataset.modalidad;
      document.querySelectorAll('.modalidad-btn').forEach(b => {
        const activa = b === btn;
        b.classList.toggle('activo', activa);
        b.setAttribute('aria-pressed', String(activa));
      });
      document.querySelectorAll('.campo-delivery').forEach(el => {
        el.hidden = modalidadPedido === 'retiro';
        if (el.hidden) {
          const campo = el.querySelector('input, select');
          campo?.classList.remove('campo-error');
          campo?.setAttribute('aria-invalid', 'false');
        }
      });
      guardarDatosCliente();
      renderCarrito();
    });
  });
  renderEstadoNegocio();
}

function obtenerInfoHorario() {
  const horario = DATA.negocio.horarios_pedido;
  if (!horario) return null;
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dia = dias[partes.find(p => p.type === 'weekday')?.value];
  const hora = partes.find(p => p.type === 'hour')?.value;
  const minuto = partes.find(p => p.type === 'minute')?.value;
  const rango = horario[String(dia)];
  if (!hora || !minuto) return null;
  const actual = Number(hora) * 60 + Number(minuto);
  const aMinutos = valor => { const [h, m] = valor.split(':').map(Number); return h * 60 + m; };
  const abierto = Boolean(rango) && actual >= aMinutos(rango[0]) && actual <= aMinutos(rango[1]);
  return { dia, actual, rango, abierto, aMinutos };
}

function textoProximaAtencion(info) {
  const horarios = DATA.negocio.horarios_pedido;
  if (info.rango && info.actual < info.aMinutos(info.rango[0])) {
    return `Atendemos hoy de ${info.rango[0]} a ${info.rango[1]}.`;
  }
  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  for (let avance = 1; avance <= 7; avance++) {
    const dia = (info.dia + avance) % 7;
    const rango = horarios[String(dia)];
    if (rango) return `Próxima atención: ${nombres[dia]} de ${rango[0]} a ${rango[1]}.`;
  }
  return DATA.negocio.horario || 'Consulta nuestro horario antes de pedir.';
}

function renderEstadoNegocio() {
  const estado = document.getElementById('estado-negocio');
  const info = obtenerInfoHorario();
  if (!estado || !info) return;
  estado.className = `estado-negocio ${info.abierto ? 'abierto' : 'cerrado'}`;
  estado.textContent = info.abierto
    ? `Abierto ahora · Entrega estimada: ${DATA.negocio.tiempo_estimado || 'por confirmar'}`
    : `Cerrado ahora · ${textoProximaAtencion(info)}`;
}

function inicializarFormularioCliente() {
  try {
    const datos = JSON.parse(localStorage.getItem('sushinan-cliente') || '{}');
    ['nombre', 'telefono', 'direccion', 'comuna', 'nota'].forEach(campo => {
      const el = document.getElementById(`cliente-${campo}`);
      if (el && datos[campo]) el.value = datos[campo];
    });
    if (datos.modalidad === 'retiro') document.querySelector('[data-modalidad="retiro"]').click();
  } catch (_) {}
  document.querySelectorAll('.cliente-campos input, .cliente-campos select').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('campo-error');
      el.setAttribute('aria-invalid', 'false');
      document.getElementById('form-error').textContent = '';
      guardarDatosCliente();
    });
    el.addEventListener('change', guardarDatosCliente);
  });
  renderCarrito();
}

function guardarDatosCliente() {
  try {
    const datos = { modalidad: modalidadPedido };
    ['nombre', 'telefono', 'direccion', 'comuna', 'nota'].forEach(campo => {
      datos[campo] = document.getElementById(`cliente-${campo}`)?.value || '';
    });
    localStorage.setItem('sushinan-cliente', JSON.stringify(datos));
  } catch (_) {}
}

function normalizarTelefono(valor) {
  let digitos = valor.replace(/\D/g, '');
  if (/^9\d{8}$/.test(digitos)) digitos = `56${digitos}`;
  return /^569\d{8}$/.test(digitos) ? `+${digitos}` : null;
}

// =====================
function inicializarPago() {
  renderDatosTransferencia();

  document.querySelectorAll('.pago-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pagoMetodo = btn.dataset.metodo;
      document.querySelectorAll('.pago-btn').forEach(b => {
        b.classList.remove('activo');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('activo');
      btn.setAttribute('aria-pressed', 'true');
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
//  CONFIRMACIÓN FINAL
// =====================
function inicializarConfirmacion() {
  const overlay = document.getElementById('confirmacion-overlay');
  const cerrar = () => cerrarConfirmacion();
  document.getElementById('confirmacion-cerrar').addEventListener('click', cerrar);
  document.getElementById('confirmacion-volver').addEventListener('click', cerrar);
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
  document.getElementById('confirmacion-continuar').addEventListener('click', () => {
    if (!pedidoPendienteUrl) return;
    const ventana = window.open(pedidoPendienteUrl, '_blank');
    if (ventana) ventana.opener = null;
    cerrarConfirmacion();
    const estado = document.getElementById('form-error');
    estado.className = 'form-error exito';
    estado.textContent = ventana
      ? 'WhatsApp está listo. Presiona Enviar para confirmar el pedido.'
      : 'Tu navegador bloqueó WhatsApp. Habilita las ventanas emergentes e inténtalo nuevamente.';
  });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('activo')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'Tab') mantenerFoco(e, document.getElementById('confirmacion-card'));
  });
}

function abrirConfirmacion(url, resumen) {
  pedidoPendienteUrl = url;
  focoAnterior = document.activeElement;
  document.getElementById('toast-carrito').classList.remove('visible');
  document.getElementById('confirmacion-resumen').innerHTML = `
    <div><span>Productos</span><strong>${resumen.cantidad}</strong></div>
    <div><span>Modalidad</span><strong>${resumen.modalidad}</strong></div>
    <div><span>Método de pago</span><strong>${resumen.pago}</strong></div>
    <div class="confirmacion-total"><span>Total</span><strong>${formatearPrecio(resumen.total)}</strong></div>`;
  const overlay = document.getElementById('confirmacion-overlay');
  overlay.classList.add('activo');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('sin-scroll');
  document.getElementById('confirmacion-card').focus();
}

function cerrarConfirmacion() {
  const overlay = document.getElementById('confirmacion-overlay');
  if (!overlay.classList.contains('activo')) return;
  overlay.classList.remove('activo');
  overlay.setAttribute('aria-hidden', 'true');
  pedidoPendienteUrl = '';
  if (!document.getElementById('carrito-panel').classList.contains('abierto') &&
      !document.getElementById('modal-overlay').classList.contains('activo')) {
    document.body.classList.remove('sin-scroll');
  }
  focoAnterior?.focus();
}

// =====================
//  WHATSAPP MESSAGE
// =====================
function enviarPedidoWhatsapp() {
  const entries = Object.values(carrito.items);
  if (entries.length === 0) return;

  const nombre    = document.getElementById('cliente-nombre').value.trim();
  const telefonoEl = document.getElementById('cliente-telefono');
  const telefono  = normalizarTelefono(telefonoEl.value);
  const direccion = document.getElementById('cliente-direccion').value.trim();
  const comuna    = document.getElementById('cliente-comuna').value.trim();
  const nota      = document.getElementById('cliente-nota').value.trim();
  const error = document.getElementById('form-error');
  error.className = 'form-error';

  const requeridos = [['cliente-nombre', nombre], ['cliente-telefono', telefono]];
  if (modalidadPedido === 'delivery') requeridos.push(['cliente-direccion', direccion], ['cliente-comuna', comuna]);
  let primerError = null;
  requeridos.forEach(([id, val]) => {
    const el = document.getElementById(id);
    el.classList.toggle('campo-error', !val);
    el.setAttribute('aria-invalid', String(!val));
    if (!val && !primerError) primerError = el;
  });
  if (primerError) {
    error.textContent = primerError.id === 'cliente-telefono'
      ? 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678.'
      : 'Completa los campos obligatorios para continuar.';
    primerError.focus();
    primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  error.textContent = '';
  telefonoEl.value = telefono;
  guardarDatosCliente();

  const textoPago = {
    efectivo:      'Efectivo al momento de la entrega',
    transferencia: 'Transferencia — envío comprobante por este chat',
    tarjeta:       'Tarjeta al momento de la entrega',
  };

  const costoEnvio = getCostoEnvio();
  const subtotal   = carrito.getTotalPrecio();
  const totalConEnvio = subtotal + costoEnvio;
  const idsBebidas = new Set(
    (DATA.categorias.find(categoria => categoria.id === 'bebidas')?.productos || []).map(producto => producto.id)
  );
  const incluyeBebidas = entries.some(({ producto }) => idsBebidas.has(producto.id.split('__')[0]));

  const detalle = entries.map(({ producto, cantidad }) =>
    `• ${cantidad}× ${producto.nombre}\n  ${formatearPrecio(producto.precio * cantidad)}`
  ).join('\n');
  const modalidadTexto = modalidadPedido === 'retiro' ? 'Retiro en local' : 'Delivery';
  let msg = `*NUEVO PEDIDO — ${DATA.negocio.nombre}*\n\n`;
  msg += `${detalle}\n\n`;
  msg += `Subtotal: ${formatearPrecio(subtotal)}\n`;
  msg += modalidadPedido === 'delivery'
    ? `Envío (${comuna}): ${formatearPrecio(costoEnvio)}\n`
    : 'Retiro en local: Sin costo\n';
  msg += `*TOTAL: ${formatearPrecio(totalConEnvio)}*\n\n`;
  msg += `Modalidad: ${modalidadTexto}\n`;
  msg += `Pago: ${textoPago[pagoMetodo]}\n`;
  msg += `Nombre: ${nombre}\n`;
  msg += `Teléfono: ${telefono}`;
  if (modalidadPedido === 'delivery') msg += `\nDirección: ${direccion}, ${comuna}`;
  if (nota) msg += `\nNota: ${nota}`;
  if (incluyeBebidas) msg += '\nBebidas: consultar por WhatsApp la disponibilidad de sabores después de confirmar el pedido.';
  if (DATA.negocio.tiempo_estimado) msg += `\n\nTiempo estimado informado: ${DATA.negocio.tiempo_estimado}`;

  const url = `https://wa.me/${DATA.negocio.telefono_whatsapp}?text=${encodeURIComponent(msg)}`;
  abrirConfirmacion(url, {
    cantidad: carrito.getTotalItems(),
    modalidad: modalidadTexto,
    pago: textoPago[pagoMetodo],
    total: totalConEnvio
  });
}
