import { DATA } from '../data.js?v=9';
import { carrito, formatearPrecio } from '../cart.js?v=9';
import { escaparHtml, fechaChileISO, horaChile, normalizarTelefono, mantenerFoco, bloquearScroll, desbloquearScroll } from './utils.js';
import { borrarDatosLocales, guardarConCaducidad, leerConCaducidad } from './storage.js';
import { obtenerInfoHorario, textoProximaAtencion, validarProgramacion } from './horarios.js';
import { mostrarAvisoSimple } from './ui.js';
import { actualizarUIFavoritos, filtrarProductos, resetFavoritos } from './favoritos.js';
import { renderBotonesCantidad } from './catalogo.js';
import { crearIdPedido, enviarPedidoGenerado } from './tracking-pedidos.js';
import {
  prepararClienteBeneficio,
  validarPrimeraCompra,
  marcarBeneficioUsadoEnDispositivo,
  beneficioUsadoEnDispositivo
} from './beneficio-primera-compra.js?v=1';

let pagoMetodo       = 'efectivo';
let modalidadPedido  = 'delivery';
let pedidoPendienteUrl = '';
let pedidoPendienteTracking = null;
let ultimoTotalRender  = null;
let focoAnterior       = null;
let beneficioPrimeraCompra = estadoBeneficioInicial();
let confirmacionEnviando = false;

export const getModalidadPedido = () => modalidadPedido;
const getCostoEnvioBase = () => {
  if (modalidadPedido === 'retiro') return 0;
  const sel     = document.getElementById('cliente-comuna');
  const comuna  = sel?.value?.trim();
  if (!comuna || !DATA.negocio.costos_envio) return 0;
  const subtotal     = carrito.getTotalPrecio();
  const gratisDesde  = Number(DATA.negocio.envio_gratis_desde) || 0;
  if (gratisDesde > 0 && subtotal >= gratisDesde) return 0;
  return DATA.negocio.costos_envio[comuna] || 0;
};
export const getCostoEnvio = () => {
  const base = getCostoEnvioBase();
  return beneficioPrimeraCompraActivo() && base > 0 ? 0 : base;
};

export function renderCarrito() {
  const itemsContainer = document.getElementById('carrito-items');
  const totalEl        = document.getElementById('carrito-total');
  const btnPedir       = document.getElementById('btn-pedir-whatsapp');
  const entries        = Object.values(carrito.items);
  actualizarBotonRepetir(entries.length === 0);
  document.getElementById('cart-count').textContent = carrito.getTotalItems();

  if (entries.length === 0) {
    itemsContainer.innerHTML = `
      <div class="carrito__vacio">
        <span class="carrito__vacio-icono">🍣</span>
        <p>Tu pedido está vacío</p>
        <span>Agrega algo delicioso</span>
      </div>`;
    totalEl.textContent = formatearPrecio(0);
    ultimoTotalRender   = 0;
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
        <div class="carrito-item__nombre">${escaparHtml(producto.nombre)} ×${cantidad}</div>
        <div class="carrito-item__precio">${formatearPrecio(producto.precio * cantidad)}</div>
      </div>
      <button class="carrito-item__quitar" data-id="${escaparHtml(producto.id)}">Quitar</button>`;
    item.querySelector('.carrito-item__quitar').addEventListener('click', () => {
      item.classList.add('saliendo');
      setTimeout(() => carrito.eliminar(producto.id), 180);
    });
    itemsContainer.appendChild(item);
  });

  const subtotal   = carrito.getTotalPrecio();
  const costoEnvio = getCostoEnvio();
  const costoEnvioBase = getCostoEnvioBase();
  const desglose   = document.getElementById('carrito-desglose');

  document.getElementById('carrito-subtotal').textContent     = formatearPrecio(subtotal);
  document.getElementById('carrito-costo-envio').textContent  = modalidadPedido === 'retiro'
    ? 'Sin costo'
    : (document.getElementById('cliente-comuna')?.value
      ? (beneficioPrimeraCompraActivo() && costoEnvioBase > 0 ? `Gratis (${formatearPrecio(costoEnvioBase)})` : formatearPrecio(costoEnvio))
      : 'Por calcular');
  document.getElementById('carrito-comuna-label').textContent = modalidadPedido === 'retiro'
    ? 'retiro'
    : (document.getElementById('cliente-comuna')?.value || 'según comuna');
  const beneficioFila = document.getElementById('carrito-beneficio-primera-compra');
  if (beneficioFila) beneficioFila.hidden = !(beneficioPrimeraCompraActivo() && costoEnvioBase > 0);
  desglose.style.display = '';
  actualizarUIBeneficioPrimeraCompra();

  const totalActual = subtotal + costoEnvio;
  totalEl.textContent = formatearPrecio(totalActual);
  if (ultimoTotalRender !== null && ultimoTotalRender !== totalActual) {
    totalEl.classList.remove('actualizado');
    void totalEl.offsetWidth;
    totalEl.classList.add('actualizado');
  }
  ultimoTotalRender = totalActual;

  const minimo = Number(DATA.negocio.pedido_minimo) || 0;
  const falta  = Math.max(0, minimo - subtotal);
  document.getElementById('carrito-aviso').textContent = falta
    ? `Faltan ${formatearPrecio(falta)} para el pedido mínimo.`
    : (DATA.negocio.tiempo_estimado ? `Tiempo estimado: ${DATA.negocio.tiempo_estimado}.` : '');
  btnPedir.disabled = falta > 0;
}

export function inicializarEventosCarrito() {
  const panel   = document.getElementById('carrito-panel');
  const overlay = document.getElementById('overlay');
  const toggle  = document.getElementById('cart-toggle');

  const cerrarCarrito = () => {
    panel.classList.remove('abierto');
    overlay.classList.remove('activo');
    panel.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    if (!document.getElementById('modal-overlay').classList.contains('activo'))
      desbloquearScroll();
    focoAnterior?.focus();
  };

  toggle.addEventListener('click', () => {
    focoAnterior = document.activeElement;
    panel.classList.add('abierto');
    overlay.classList.add('activo');
    panel.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    bloquearScroll();
    panel.focus();
  });

  document.getElementById('cart-close').addEventListener('click', cerrarCarrito);
  overlay.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-pedir-whatsapp').addEventListener('click', enviarPedidoWhatsapp);
  document.getElementById('btn-vaciar').addEventListener('click', () => {
    if (window.confirm('¿Quieres vaciar todo el pedido?')) carrito.vaciar();
  });

  document.addEventListener('keydown', e => {
    if (!panel.classList.contains('abierto')) return;
    if (document.getElementById('confirmacion-overlay').classList.contains('activo')) return;
    if (e.key === 'Escape') cerrarCarrito();
    if (e.key === 'Tab')    mantenerFoco(e, panel);
  });
}

export function inicializarComunas() {
  const sel = document.getElementById('cliente-comuna');
  if (!sel || !DATA.negocio.zonas_cobertura) return;
  DATA.negocio.zonas_cobertura.split(',').map(c => c.trim()).filter(Boolean).forEach(c => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = c;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    invalidarBeneficioSiCambianDatos();
    renderCarrito();
  });
}

export function inicializarModalidad() {
  const comoLlegar = document.getElementById('como-llegar');
  if (comoLlegar && DATA.negocio.direccion) {
    comoLlegar.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${DATA.negocio.direccion}, Chile`)}`;
  }
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
      document.querySelectorAll('.campo-retiro').forEach(el => { el.hidden = modalidadPedido !== 'retiro'; });
      if (modalidadPedido === 'retiro') invalidarBeneficioPrimeraCompra('El beneficio aplica solo a delivery.');
      guardarDatosCliente();
      renderCarrito();
    });
  });
  renderEstadoNegocio();
}

export function inicializarFormularioCliente() {
  try {
    const datos = leerConCaducidad('sushinan-cliente') || {};
    document.getElementById('recordar-datos').checked = Boolean(Object.keys(datos).length);
    ['nombre', 'telefono', 'direccion', 'comuna', 'nota', 'palillos', 'fecha-pedido', 'hora-pedido'].forEach(campo => {
      const el = document.getElementById(`cliente-${campo}`);
      if (el && datos[campo] !== undefined) el.value = datos[campo];
    });
    document.getElementById('cliente-sin-soya').checked   = Boolean(datos.sinSoya);
    document.getElementById('cliente-sin-wasabi').checked = Boolean(datos.sinWasabi);
    document.getElementById('programar-pedido').checked   = Boolean(datos.programarPedido);
    if (datos.modalidad === 'retiro') document.querySelector('[data-modalidad="retiro"]')?.click();
  } catch (_) {}

  document.querySelectorAll('.cliente-campos input, .cliente-campos select').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('campo-error');
      el.setAttribute('aria-invalid', 'false');
      document.getElementById('form-error').textContent = '';
      invalidarBeneficioSiCambianDatos();
      guardarDatosCliente();
      renderCarrito();
    });
    el.addEventListener('change', () => {
      invalidarBeneficioSiCambianDatos();
      guardarDatosCliente();
      renderCarrito();
    });
  });
  renderCarrito();
}

export function inicializarPrivacidad() {
  const recordar = document.getElementById('recordar-datos');
  recordar.addEventListener('change', () => {
    if (recordar.checked) guardarDatosCliente();
    else localStorage.removeItem('sushinan-cliente');
  });

  document.getElementById('borrar-datos').addEventListener('click', () => {
    if (!window.confirm('¿Quieres borrar tus datos, favoritos, carrito y último pedido de este dispositivo?')) return;
    borrarDatosLocales(['sushinan-cliente', 'sushinan-ultimo-pedido', 'sushinan-carrito', 'sushinan-favoritos', 'sushinan-device-id', 'sushinan-primera-compra-usada']);
    resetFavoritos();
    document.querySelectorAll('.cliente-campos input').forEach(input => {
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
    });
    document.querySelectorAll('.cliente-campos select').forEach(sel => { sel.selectedIndex = 0; });
    recordar.checked = false;
    carrito.items = {};
    carrito.actualizar();
    actualizarUIFavoritos();
    document.getElementById('favoritos-filtro').classList.remove('activo');
    document.getElementById('favoritos-filtro').setAttribute('aria-pressed', 'false');
    filtrarProductos('');
    mostrarAvisoSimple('Datos locales eliminados');
  });
}

export function inicializarProgramacionPedido() {
  const toggle   = document.getElementById('programar-pedido');
  const campos   = document.getElementById('programacion-campos');
  const fecha    = document.getElementById('cliente-fecha-pedido');
  const hora     = document.getElementById('cliente-hora-pedido');
  const errorEl  = document.getElementById('form-error');
  const hoyChile = fechaChileISO();

  fecha.min = hoyChile;

  function aplicarRestriccionesHorario() {
    const valorFecha = fecha.value;
    if (!valorFecha) { hora.removeAttribute('min'); hora.removeAttribute('max'); return; }

    const dia   = new Date(`${valorFecha}T12:00:00`).getDay();
    const rango = DATA.negocio.horarios_pedido?.[String(dia)];

    if (!rango) {
      const nombres = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
      fecha.classList.add('campo-error');
      fecha.setAttribute('aria-invalid', 'true');
      errorEl.className   = 'form-error';
      errorEl.textContent = `El local no atiende los ${nombres[dia]}. Por favor elige otro día.`;
      hora.removeAttribute('min');
      hora.removeAttribute('max');
      hora.value = '';
      return;
    }

    fecha.classList.remove('campo-error');
    fecha.setAttribute('aria-invalid', 'false');
    if (errorEl.textContent && !errorEl.classList.contains('exito')) errorEl.textContent = '';

    const minHora = valorFecha === hoyChile
      ? horaChile()
      : rango[0];
    const minEfectivo = minHora > rango[0] ? minHora : rango[0];

    hora.min = minEfectivo;
    hora.max = rango[1];

    const aviso = document.getElementById('horario-programacion-aviso');
    if (aviso) aviso.textContent = `Horario disponible: ${rango[0]} – ${rango[1]}`;

    if (hora.value && (hora.value < hora.min || hora.value > hora.max)) {
      hora.classList.add('campo-error');
      hora.setAttribute('aria-invalid', 'true');
      errorEl.textContent = `Para ese día atendemos de ${rango[0]} a ${rango[1]}.`;
    }
  }

  if (toggle.checked && !fecha.value) fecha.value = hoyChile;
  aplicarRestriccionesHorario();

  fecha.addEventListener('change', () => {
    hora.value = '';
    hora.classList.remove('campo-error');
    hora.setAttribute('aria-invalid', 'false');
    aplicarRestriccionesHorario();
    guardarDatosCliente();
  });

  hora.addEventListener('change', () => {
    if (hora.value && hora.min && hora.value < hora.min) {
      hora.classList.add('campo-error');
      hora.setAttribute('aria-invalid', 'true');
      errorEl.className   = 'form-error';
      errorEl.textContent = `La hora debe ser después de las ${hora.min}.`;
    } else if (hora.value && hora.max && hora.value > hora.max) {
      hora.classList.add('campo-error');
      hora.setAttribute('aria-invalid', 'true');
      errorEl.className   = 'form-error';
      errorEl.textContent = `El último pedido del día es a las ${hora.max}.`;
    } else {
      hora.classList.remove('campo-error');
      hora.setAttribute('aria-invalid', 'false');
      if (errorEl.textContent && !errorEl.classList.contains('exito')) errorEl.textContent = '';
    }
    guardarDatosCliente();
  });

  const actualizar = () => {
    campos.hidden  = !toggle.checked;
    fecha.required = toggle.checked;
    hora.required  = toggle.checked;
    if (toggle.checked) aplicarRestriccionesHorario();
    guardarDatosCliente();
  };

  toggle.addEventListener('change', () => {
    if (toggle.checked && !fecha.value) { fecha.value = hoyChile; aplicarRestriccionesHorario(); }
    actualizar();
  });
  actualizar();
}

export function inicializarUltimoPedido() {
  const boton = document.getElementById('repetir-ultimo-pedido');
  boton.addEventListener('click', () => {
    const pedido = obtenerUltimoPedido();
    if (!pedido) return;
    carrito.items = JSON.parse(JSON.stringify(pedido.items));
    document.querySelector(`[data-modalidad="${pedido.modalidad || 'delivery'}"]`)?.click();
    document.getElementById('cliente-palillos').value = pedido.opciones?.palillos || '0';
    document.getElementById('cliente-sin-soya').checked   = Boolean(pedido.opciones?.sinSoya);
    document.getElementById('cliente-sin-wasabi').checked = Boolean(pedido.opciones?.sinWasabi);
    document.getElementById('programar-pedido').checked   = false;
    document.getElementById('programacion-campos').hidden = true;
    document.getElementById('cliente-fecha-pedido').value    = '';
    document.getElementById('cliente-fecha-pedido').required = false;
    document.getElementById('cliente-hora-pedido').value     = '';
    document.getElementById('cliente-hora-pedido').required  = false;
    guardarDatosCliente();
    carrito.actualizar();
    mostrarAvisoSimple('Último pedido restaurado');
  });
  actualizarBotonRepetir();
}

export function inicializarPago() {
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

export function inicializarBeneficioPrimeraCompra() {
  actualizarUIBeneficioPrimeraCompra();
  document.getElementById('primera-compra-validar')?.addEventListener('click', () => {
    validarBeneficioPrimeraCompraManual();
  });
}

export function inicializarConfirmacion() {
  const overlay = document.getElementById('confirmacion-overlay');
  const cerrar  = cerrarConfirmacion;
  document.getElementById('confirmacion-cerrar').addEventListener('click', cerrar);
  document.getElementById('confirmacion-volver').addEventListener('click', cerrar);
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
  document.getElementById('confirmacion-continuar').addEventListener('click', () => {
    if (!pedidoPendienteUrl || confirmacionEnviando) return;
    confirmacionEnviando = true;
    document.getElementById('confirmacion-continuar').disabled = true;
    guardarUltimoPedidoConfirmado();
    if (pedidoPendienteTracking?.beneficioPrimeraCompra?.aplicado) {
      marcarBeneficioUsadoEnDispositivo(pedidoPendienteTracking.beneficioPrimeraCompra.cliente);
      bloquearBeneficioPrimeraCompraUsadoLocalmente();
      renderCarrito();
    }
    enviarPedidoGenerado(pedidoPendienteTracking);
    const ventana = window.open(pedidoPendienteUrl, '_blank');
    if (ventana) ventana.opener = null;
    cerrarConfirmacion();
    const estado = document.getElementById('form-error');
    estado.className   = 'form-error exito';
    estado.textContent = ventana
      ? 'WhatsApp está listo. Presiona Enviar para confirmar el pedido.'
      : 'Tu navegador bloqueó WhatsApp. Habilita las ventanas emergentes e inténtalo nuevamente.';
  });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('activo')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'Tab')    mantenerFoco(e, document.getElementById('confirmacion-card'));
  });
}

export function inicializarWspFlotante() {
  const btn = document.getElementById('wsp-flotante');
  if (!btn || !DATA.negocio.telefono_whatsapp) return;
  btn.href = `https://wa.me/${DATA.negocio.telefono_whatsapp}`;
}

// ── Internos ────────────────────────────────────────────────────────────────

function estadoBeneficioInicial() {
  return {
    estado: 'idle',
    token: '',
    clienteClave: '',
    cliente: null,
    ahorro: 0,
    motivo: '',
    coincidencias: []
  };
}

function leerClienteBeneficioActual() {
  const telefono = normalizarTelefono(document.getElementById('cliente-telefono')?.value || '');
  return prepararClienteBeneficio({
    nombre: document.getElementById('cliente-nombre')?.value || '',
    telefono: telefono || '',
    direccion: document.getElementById('cliente-direccion')?.value || '',
    comuna: document.getElementById('cliente-comuna')?.value || ''
  });
}

function beneficioPrimeraCompraActivo() {
  if (modalidadPedido !== 'delivery') return false;
  if (beneficioUsadoEnDispositivo()?.usado) return false;
  if (beneficioPrimeraCompra.estado !== 'aplicado') return false;
  return beneficioPrimeraCompra.clienteClave === leerClienteBeneficioActual().clave;
}

function bloquearBeneficioPrimeraCompraUsadoLocalmente(motivo = 'Este dispositivo ya usó el beneficio de primera compra.') {
  if (!beneficioUsadoEnDispositivo()?.usado) return false;
  const cliente = leerClienteBeneficioActual();
  beneficioPrimeraCompra = {
    ...estadoBeneficioInicial(),
    estado: 'rechazado',
    clienteClave: cliente.clave,
    cliente,
    motivo,
    coincidencias: ['dispositivo']
  };
  return true;
}

function invalidarBeneficioPrimeraCompra(motivo = '') {
  beneficioPrimeraCompra = { ...estadoBeneficioInicial(), estado: motivo ? 'idle' : 'idle', motivo };
  actualizarUIBeneficioPrimeraCompra();
}

function invalidarBeneficioSiCambianDatos() {
  if (beneficioPrimeraCompra.estado === 'idle') return;
  const cliente = leerClienteBeneficioActual();
  if (beneficioPrimeraCompra.clienteClave && beneficioPrimeraCompra.clienteClave !== cliente.clave) {
    beneficioPrimeraCompra = {
      ...estadoBeneficioInicial(),
      estado: 'idle',
      motivo: 'Los datos cambiaron. Vuelve a validar el despacho gratis.'
    };
  }
}

function actualizarUIBeneficioPrimeraCompra() {
  const box = document.getElementById('primera-compra-box');
  const estado = document.getElementById('primera-compra-estado');
  const boton = document.getElementById('primera-compra-validar');
  if (!box || !estado || !boton) return;

  box.classList.remove('aplicado', 'rechazado', 'error');
  boton.disabled = false;
  boton.textContent = 'Validar';

  if (modalidadPedido !== 'delivery') {
    estado.textContent = 'Disponible solo para pedidos con delivery.';
    boton.disabled = true;
    return;
  }

  const costoBase = getCostoEnvioBase();
  const tieneComuna = Boolean(document.getElementById('cliente-comuna')?.value);
  if (tieneComuna && costoBase === 0) {
    estado.textContent = 'Tu envío ya figura sin costo para este pedido.';
    boton.disabled = true;
    return;
  }

  bloquearBeneficioPrimeraCompraUsadoLocalmente();

  if (beneficioPrimeraCompra.estado === 'validando') {
    estado.textContent = 'Validando si corresponde el despacho gratis...';
    boton.textContent = 'Validando...';
    boton.disabled = true;
    return;
  }

  if (beneficioPrimeraCompra.estado === 'aplicado' && beneficioPrimeraCompraActivo()) {
    box.classList.add('aplicado');
    estado.textContent = `Despacho gratis aplicado. Ahorras ${formatearPrecio(beneficioPrimeraCompra.ahorro)}.`;
    boton.textContent = 'Aplicado';
    boton.disabled = true;
    return;
  }

  if (beneficioPrimeraCompra.estado === 'rechazado') {
    box.classList.add('rechazado');
    estado.textContent = beneficioPrimeraCompra.motivo || 'El beneficio ya fue usado con estos datos.';
    boton.textContent = 'Revalidar';
    return;
  }

  if (beneficioPrimeraCompra.estado === 'error') {
    box.classList.add('error');
    estado.textContent = beneficioPrimeraCompra.motivo || 'No se pudo validar ahora. Puedes pedir normalmente.';
    boton.textContent = 'Reintentar';
    return;
  }

  estado.textContent = beneficioPrimeraCompra.motivo || 'Valida con tu teléfono, dirección y este dispositivo.';
}

async function validarBeneficioPrimeraCompraManual() {
  return validarBeneficioPrimeraCompraInterno({ silencioso: false, forzar: true });
}

async function validarBeneficioPrimeraCompraAutomatico() {
  return validarBeneficioPrimeraCompraInterno({ silencioso: true, forzar: false });
}

async function validarBeneficioPrimeraCompraInterno({ silencioso = false, forzar = false } = {}) {
  if (modalidadPedido !== 'delivery') return false;

  const costoBase = getCostoEnvioBase();
  if (costoBase <= 0) return false;
  if (bloquearBeneficioPrimeraCompraUsadoLocalmente()) {
    renderCarrito();
    return false;
  }
  if (beneficioPrimeraCompraActivo()) return true;

  const telefono = normalizarTelefono(document.getElementById('cliente-telefono')?.value || '');
  const direccion = document.getElementById('cliente-direccion')?.value.trim();
  const comuna = document.getElementById('cliente-comuna')?.value.trim();
  if (!telefono || !direccion || !comuna) {
    if (!silencioso) {
      beneficioPrimeraCompra = {
        ...estadoBeneficioInicial(),
        estado: 'error',
        motivo: 'Completa teléfono, dirección y comuna para validar.'
      };
      actualizarUIBeneficioPrimeraCompra();
    }
    return false;
  }

  const cliente = leerClienteBeneficioActual();
  if (!forzar && beneficioPrimeraCompra.estado === 'rechazado' && beneficioPrimeraCompra.clienteClave === cliente.clave) {
    return false;
  }

  beneficioPrimeraCompra = {
    ...estadoBeneficioInicial(),
    estado: 'validando',
    clienteClave: cliente.clave,
    cliente,
    ahorro: costoBase
  };
  actualizarUIBeneficioPrimeraCompra();

  const resultado = await validarPrimeraCompra(cliente);
  if (beneficioPrimeraCompra.clienteClave !== cliente.clave) return false;

  if (resultado.ok && resultado.elegible) {
    beneficioPrimeraCompra = {
      estado: 'aplicado',
      token: resultado.token || '',
      clienteClave: cliente.clave,
      cliente,
      ahorro: costoBase,
      motivo: 'Despacho gratis aplicado.',
      coincidencias: resultado.coincidencias?.length ? resultado.coincidencias : ['telefono', 'direccion', 'dispositivo']
    };
    renderCarrito();
    return true;
  }

  beneficioPrimeraCompra = {
    ...estadoBeneficioInicial(),
    estado: resultado.ok ? 'rechazado' : 'error',
    clienteClave: cliente.clave,
    cliente,
    ahorro: 0,
    motivo: resultado.motivo || (resultado.ok
      ? 'Este beneficio ya fue usado con estos datos.'
      : 'No se pudo validar ahora. Puedes pedir normalmente.'),
    coincidencias: resultado.coincidencias || []
  };
  renderCarrito();
  return false;
}

function obtenerBeneficioPrimeraCompraParaPedido(ahorro) {
  if (beneficioUsadoEnDispositivo()?.usado) return { aplicado: false };
  if (!beneficioPrimeraCompraActivo() || ahorro <= 0) return { aplicado: false };
  return {
    aplicado: true,
    tipo: 'despacho_gratis_primera_compra',
    ahorro,
    token: beneficioPrimeraCompra.token,
    validadoPor: beneficioPrimeraCompra.coincidencias,
    cliente: beneficioPrimeraCompra.cliente
  };
}

function guardarDatosCliente() {
  try {
    if (!document.getElementById('recordar-datos').checked) {
      localStorage.removeItem('sushinan-cliente');
      return;
    }
    const datos = {
      modalidad:      modalidadPedido,
      sinSoya:        document.getElementById('cliente-sin-soya').checked,
      sinWasabi:      document.getElementById('cliente-sin-wasabi').checked,
      programarPedido: document.getElementById('programar-pedido').checked
    };
    ['nombre', 'telefono', 'direccion', 'comuna', 'nota', 'palillos', 'fecha-pedido', 'hora-pedido'].forEach(campo => {
      datos[campo] = document.getElementById(`cliente-${campo}`)?.value || '';
    });
    guardarConCaducidad('sushinan-cliente', datos, 30);
  } catch (_) {}
}

function renderEstadoNegocio() {
  const estado = document.getElementById('estado-negocio');
  const info   = obtenerInfoHorario(DATA.negocio);
  if (!estado || !info) return;
  estado.className  = `estado-negocio ${info.abierto ? 'abierto' : 'cerrado'}`;
  estado.textContent = info.abierto
    ? `Abierto ahora · Entrega estimada: ${DATA.negocio.tiempo_estimado || 'por confirmar'}`
    : `Cerrado ahora · ${textoProximaAtencion(DATA.negocio, info)}`;
}

function obtenerUltimoPedido() {
  try {
    const pedido = leerConCaducidad('sushinan-ultimo-pedido');
    if (!pedido || pedido.version !== (DATA.negocio.catalogo_version || 1) || !pedido.items) return null;
    const catalogo   = new Map(DATA.categorias.flatMap(c => c.productos).map(p => [p.id, p]));
    const itemsValidos = Object.fromEntries(Object.entries(pedido.items).filter(([, item]) => {
      const base = catalogo.get(item?.producto?.id?.split('__')[0]);
      return base && base.disponible !== false && item.cantidad > 0 && item.cantidad <= 99;
    }));
    return Object.keys(itemsValidos).length ? { ...pedido, items: itemsValidos } : null;
  } catch (_) { return null; }
}

function guardarUltimoPedidoConfirmado() {
  try {
    guardarConCaducidad('sushinan-ultimo-pedido', {
      version:   DATA.negocio.catalogo_version || 1,
      fecha:     new Date().toISOString(),
      modalidad: modalidadPedido,
      items:     carrito.items,
      opciones:  {
        palillos: document.getElementById('cliente-palillos').value,
        sinSoya:  document.getElementById('cliente-sin-soya').checked,
        sinWasabi: document.getElementById('cliente-sin-wasabi').checked
      }
    }, 30);
  } catch (_) {}
}

function actualizarBotonRepetir(carritoVacio = carrito.getTotalItems() === 0) {
  const boton = document.getElementById('repetir-ultimo-pedido');
  if (boton) boton.hidden = !carritoVacio || !obtenerUltimoPedido();
}

function renderDatosTransferencia() {
  const datos     = DATA.negocio.pago_transferencia;
  const container = document.getElementById('transferencia-datos');
  if (!datos || !container) return;
  const filas = [
    { label: 'Banco',   valor: datos.banco,         copiable: false },
    { label: 'Tipo',    valor: datos.tipo_cuenta,   copiable: false },
    { label: 'Número',  valor: datos.numero_cuenta, copiable: true  },
    { label: 'Titular', valor: datos.titular,       copiable: false },
    { label: 'RUT',     valor: datos.rut,           copiable: true  },
    { label: 'Email',   valor: datos.email,         copiable: true  },
  ];
  container.innerHTML = filas.map(f => `
    <div class="dato-row ${f.copiable ? 'copiable' : ''}" ${f.copiable ? `data-valor="${escaparHtml(f.valor)}"` : ''}>
      <span>${escaparHtml(f.label)}</span>
      <strong>${escaparHtml(f.valor)}</strong>
    </div>`).join('');
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
  document.getElementById('transferencia-panel').classList.toggle('visible', pagoMetodo === 'transferencia');
}

function abrirConfirmacion(url, resumen, trackingPayload) {
  pedidoPendienteUrl = url;
  pedidoPendienteTracking = trackingPayload;
  confirmacionEnviando = false;
  focoAnterior       = document.activeElement;
  const botonContinuar = document.getElementById('confirmacion-continuar');
  if (botonContinuar) botonContinuar.disabled = false;
  document.getElementById('toast-carrito').classList.remove('visible');

  const productosHtml = resumen.productos.map(item => `
    <div class="confirmacion-producto-item">
      <strong>${item.cantidad}× ${escaparHtml(item.nombre)}</strong>
      <span>${formatearPrecio(item.total)}</span>
    </div>`).join('');
  const beneficioHtml = resumen.beneficio?.aplicado ? `
    <div class="confirmacion-beneficio">
      <span>Beneficio</span>
      <strong>Despacho gratis (-${formatearPrecio(resumen.beneficio.ahorro)})</strong>
    </div>` : '';

  document.getElementById('confirmacion-resumen').innerHTML = `
    <div class="confirmacion-productos">
      <span>Productos</span>
      <div class="confirmacion-productos-lista">${productosHtml}</div>
    </div>
    <div><span>Modalidad</span><strong>${escaparHtml(resumen.modalidad)}</strong></div>
    <div><span>Fecha y hora</span><strong>${escaparHtml(resumen.programacion)}</strong></div>
    <div><span>Método de pago</span><strong>${escaparHtml(resumen.pago)}</strong></div>
    ${beneficioHtml}
    <div class="confirmacion-total"><span>Total</span><strong>${formatearPrecio(resumen.total)}</strong></div>`;

  const overlay = document.getElementById('confirmacion-overlay');
  overlay.classList.add('activo');
  overlay.setAttribute('aria-hidden', 'false');
  bloquearScroll();
  document.getElementById('confirmacion-card').focus();
}

function cerrarConfirmacion() {
  const overlay = document.getElementById('confirmacion-overlay');
  if (!overlay.classList.contains('activo')) return;
  overlay.classList.remove('activo');
  overlay.setAttribute('aria-hidden', 'true');
  pedidoPendienteUrl = '';
  pedidoPendienteTracking = null;
  confirmacionEnviando = false;
  const botonContinuar = document.getElementById('confirmacion-continuar');
  if (botonContinuar) botonContinuar.disabled = false;
  if (!document.getElementById('carrito-panel').classList.contains('abierto') &&
      !document.getElementById('modal-overlay').classList.contains('activo'))
    desbloquearScroll();
  focoAnterior?.focus();
}

async function enviarPedidoWhatsapp() {
  const entries = Object.values(carrito.items);
  if (entries.length === 0) return;

  const nombre     = document.getElementById('cliente-nombre').value.trim();
  const telefonoEl = document.getElementById('cliente-telefono');
  const telefono   = normalizarTelefono(telefonoEl.value);
  const direccion  = document.getElementById('cliente-direccion').value.trim();
  const comuna     = document.getElementById('cliente-comuna').value.trim();
  const nota       = document.getElementById('cliente-nota').value.trim();
  const palillos   = document.getElementById('cliente-palillos').value;
  const sinSoya    = document.getElementById('cliente-sin-soya').checked;
  const sinWasabi  = document.getElementById('cliente-sin-wasabi').checked;
  const programarPedido = document.getElementById('programar-pedido').checked;
  const fechaPedido = document.getElementById('cliente-fecha-pedido').value;
  const horaPedido  = document.getElementById('cliente-hora-pedido').value;
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
  if (programarPedido) {
    const errorProg = validarProgramacion(DATA.negocio, fechaPedido, horaPedido);
    if (errorProg) {
      error.textContent = errorProg;
      document.getElementById(!fechaPedido ? 'cliente-fecha-pedido' : 'cliente-hora-pedido').focus();
      return;
    }
  }
  error.textContent = '';
  telefonoEl.value = telefono;
  guardarDatosCliente();
  await validarBeneficioPrimeraCompraAutomatico();

  const textoPago = {
    efectivo:      'Efectivo al momento de la entrega',
    transferencia: 'Transferencia — envío comprobante por este chat',
    tarjeta:       'Tarjeta al momento de la entrega',
  };
  const costoEnvioBase = getCostoEnvioBase();
  const costoEnvio    = getCostoEnvio();
  const subtotal      = carrito.getTotalPrecio();
  const totalConEnvio = subtotal + costoEnvio;
  const beneficioPedido = obtenerBeneficioPrimeraCompraParaPedido(costoEnvioBase);
  const idsBebidas    = new Set(
    (DATA.categorias.find(c => c.id === 'bebidas')?.productos || []).map(p => p.id)
  );
  const incluyeBebidas = entries.some(({ producto }) => idsBebidas.has(producto.id.split('__')[0]));

  const detalle        = entries.map(({ producto, cantidad }) =>
    `• ${cantidad}× ${producto.nombre}\n  ${formatearPrecio(producto.precio * cantidad)}`
  ).join('\n');
  const modalidadTexto = modalidadPedido === 'retiro' ? 'Retiro en local' : 'Delivery';
  const productosResumen = entries.map(({ producto, cantidad }) => ({
    id: producto.id,
    nombre: producto.nombre,
    cantidad,
    precioUnitario: producto.precio,
    total: producto.precio * cantidad,
    promocion: producto.promocionProgramada?.activa ? {
      activa: true,
      descuento: producto.promocionProgramada.descuento,
      precioRegular: producto.promocionProgramada.precioRegular,
      precioOferta: producto.promocionProgramada.precioOferta,
      vigencia: producto.promocionProgramada.vigencia
    } : null
  }));

  let msg = `*NUEVO PEDIDO — ${DATA.negocio.nombre}*\n\n`;
  msg += `${detalle}\n\n`;
  msg += `Subtotal: ${formatearPrecio(subtotal)}\n`;
  msg += modalidadPedido === 'delivery'
    ? (beneficioPedido.aplicado
      ? `Envío (${comuna}): Gratis por primera compra (antes ${formatearPrecio(costoEnvioBase)})\n`
      : `Envío (${comuna}): ${formatearPrecio(costoEnvio)}\n`)
    : 'Retiro en local: Sin costo\n';
  msg += `*TOTAL: ${formatearPrecio(totalConEnvio)}*\n\n`;
  msg += `Modalidad: ${modalidadTexto}\n`;
  msg += `Pago: ${textoPago[pagoMetodo]}\n`;
  if (beneficioPedido.aplicado) {
    msg += `Beneficio aplicado: Despacho gratis por primera compra\n`;
    msg += `Validado por: teléfono, dirección y dispositivo\n`;
  }
  msg += `Nombre: ${nombre}\n`;
  msg += `Teléfono: ${telefono}`;
  if (modalidadPedido === 'delivery') msg += `\nDirección: ${direccion}, ${comuna}`;
  if (programarPedido) {
    const fechaTexto = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' })
      .format(new Date(`${fechaPedido}T12:00:00`));
    msg += `\nPedido programado: ${fechaTexto} a las ${horaPedido}`;
  } else {
    msg += '\nHorario solicitado: Lo antes posible';
  }
  msg += `\nPalillos: ${palillos === '0' ? 'No necesita' : `${palillos} par${palillos === '1' ? '' : 'es'}`}`;
  if (sinSoya)    msg += '\nPreferencia: Sin soya';
  if (sinWasabi)  msg += '\nPreferencia: Sin wasabi';
  if (nota)       msg += `\nNota: ${nota}`;
  if (incluyeBebidas) msg += '\nBebidas: consultar por WhatsApp la disponibilidad de sabores después de confirmar el pedido.';
  if (DATA.negocio.tiempo_estimado) msg += `\n\nTiempo estimado informado: ${DATA.negocio.tiempo_estimado}`;

  const url = `https://wa.me/${DATA.negocio.telefono_whatsapp}?text=${encodeURIComponent(msg)}`;
  abrirConfirmacion(url, {
    productos: productosResumen,
    modalidad:     modalidadTexto,
    programacion:  programarPedido ? `${fechaPedido} · ${horaPedido}` : 'Lo antes posible',
    pago:          textoPago[pagoMetodo],
    beneficio:     beneficioPedido,
    total:         totalConEnvio
  }, {
    orderId:       crearIdPedido(),
    modalidad:     modalidadTexto,
    comuna:        modalidadPedido === 'delivery' ? comuna : '',
    pago:          textoPago[pagoMetodo],
    programacion:  {
      tipo:  programarPedido ? 'programado' : 'lo_antes_posible',
      fecha: programarPedido ? fechaPedido : '',
      hora:  programarPedido ? horaPedido : ''
    },
    subtotal,
    envio:         costoEnvio,
    total:         totalConEnvio,
    cantidadItems: carrito.getTotalItems(),
    incluyeBebidas,
    beneficioPrimeraCompra: beneficioPedido,
    preferencias:  {
      palillos,
      sinSoya,
      sinWasabi,
      notaCliente: Boolean(nota)
    },
    items:         productosResumen
  });
}
