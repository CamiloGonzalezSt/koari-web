import { carrito } from '../cart.js?v=8';

let toastTimer = null;

// Unifica todos los toasts: texto, acción opcional de "deshacer", duración.
export function mostrarToast({ texto, deshacer = null, duracion = 3000 }) {
  const toastEl    = document.getElementById('toast-carrito');
  const textoEl    = document.getElementById('toast-carrito-texto');
  const deshacerEl = document.getElementById('toast-deshacer');
  clearTimeout(toastTimer);
  textoEl.textContent = texto;
  deshacerEl.hidden = deshacer === null;
  deshacerEl.onclick = deshacer;
  toastEl.classList.remove('visible');
  void toastEl.offsetWidth;
  toastEl.classList.add('visible');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    deshacerEl.hidden = false;
    deshacerEl.onclick = null;
  }, duracion);
}

export function mostrarAvisoSimple(texto) {
  mostrarToast({ texto, duracion: 2800 });
}

export function animarCartBtn() {
  const btn = document.getElementById('cart-toggle');
  btn.classList.remove('bouncing');
  void btn.offsetWidth;
  btn.classList.add('bouncing');
}

export function centrarBotonNav(nav, btn) {
  const destino = btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2;
  nav.scrollTo({ left: destino, behavior: 'smooth' });
}

export function animarProductoAlCarrito(origen) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const contenedor = origen?.closest?.('.producto-card, .modal-card');
  const imagen     = contenedor?.querySelector('img');
  const destino    = document.getElementById('cart-toggle');
  if (!imagen || !destino) return;
  const inicio  = imagen.getBoundingClientRect();
  const fin     = destino.getBoundingClientRect();
  const clon    = imagen.cloneNode();
  clon.className = 'producto-volando';
  const tamano   = Math.min(92, Math.max(64, inicio.width * 0.32));
  const izquierda = inicio.left + inicio.width / 2 - tamano / 2;
  const arriba    = inicio.top  + inicio.height / 2 - tamano / 2;
  Object.assign(clon.style, {
    left: `${izquierda}px`, top: `${arriba}px`,
    width: `${tamano}px`,   height: `${tamano}px`
  });
  document.body.appendChild(clon);
  clon.style.setProperty('--vuelo-x', `${fin.left + fin.width / 2 - (izquierda + tamano / 2)}px`);
  clon.style.setProperty('--vuelo-y', `${fin.top  + fin.height / 2 - (arriba   + tamano / 2)}px`);
  requestAnimationFrame(() => requestAnimationFrame(() => clon.classList.add('en-vuelo')));
  setTimeout(() => {
    clon.remove();
    destino.classList.remove('impacto');
    void destino.offsetWidth;
    destino.classList.add('impacto');
  }, 720);
}

export function inicializarMicrointeracciones() {
  document.addEventListener('carrito:agregado', ({ detail: { producto, origen } }) => {
    animarProductoAlCarrito(origen);
    mostrarToast({
      texto: `${producto.nombre} agregado`,
      deshacer: () => carrito.quitar(producto.id),
      duracion: 4200
    });
    const cta = document.getElementById('btn-pedir-whatsapp');
    cta.classList.remove('llamada-atencion');
    void cta.offsetWidth;
    cta.classList.add('llamada-atencion');
    setTimeout(() => cta.classList.remove('llamada-atencion'), 900);
  });
}

export function inicializarObservadoresVisuales() {
  const cards = document.querySelectorAll('.producto-card');
  if (!('IntersectionObserver' in window)) {
    cards.forEach(card => card.classList.add('revelada'));
    return;
  }

  const observadorCards = new IntersectionObserver((entradas, observer) => {
    entradas.forEach(entrada => {
      if (!entrada.isIntersecting) return;
      entrada.target.style.setProperty('--reveal-delay', `${Math.min(Number(entrada.target.dataset.indice) || 0, 5) * 45}ms`);
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
    const visible = entradas
      .filter(e => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const id  = visible.target.id.replace('seccion-', '');
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
