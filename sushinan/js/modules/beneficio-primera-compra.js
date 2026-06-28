const ENDPOINT_BENEFICIO = '/api/primera-compra';
const CLAVE_DEVICE_ID = 'sushinan-device-id';
const CLAVE_BENEFICIO_LOCAL = 'sushinan-primera-compra-usada';

export function obtenerDeviceId() {
  try {
    let id = localStorage.getItem(CLAVE_DEVICE_ID);
    if (!id) {
      id = `dev-${(globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, '').slice(0, 36)}`;
      localStorage.setItem(CLAVE_DEVICE_ID, id);
    }
    return id;
  } catch (_) {
    return `dev-session-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarDireccion(valor) {
  return normalizarTexto(valor)
    .replace(/\bavenida\b/g, 'av')
    .replace(/\bavda\b/g, 'av')
    .replace(/\bpasaje\b/g, 'psje')
    .replace(/\bdepartamento\b/g, 'depto')
    .replace(/\bdpto\b/g, 'depto')
    .replace(/\s+/g, ' ')
    .trim();
}

export function telefonoSoloDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function prepararClienteBeneficio({ nombre, telefono, direccion, comuna }) {
  const telefonoNormalizado = telefonoSoloDigitos(telefono);
  const nombreNormalizado = normalizarTexto(nombre);
  const direccionNormalizada = normalizarDireccion(direccion);
  const comunaNormalizada = normalizarTexto(comuna);
  const deviceId = obtenerDeviceId();

  return {
    nombre: String(nombre || '').trim().slice(0, 120),
    nombreNormalizado,
    telefono: telefonoNormalizado,
    direccion: String(direccion || '').trim().slice(0, 180),
    direccionNormalizada,
    comuna: String(comuna || '').trim().slice(0, 80),
    comunaNormalizada,
    deviceId,
    clave: `${telefonoNormalizado}|${direccionNormalizada}|${comunaNormalizada}|${deviceId}`
  };
}

export function beneficioUsadoEnDispositivo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_BENEFICIO_LOCAL) || 'null');
  } catch (_) {
    return null;
  }
}

export function marcarBeneficioUsadoEnDispositivo(datos) {
  try {
    localStorage.setItem(CLAVE_BENEFICIO_LOCAL, JSON.stringify({
      usado: true,
      fecha: new Date().toISOString(),
      telefono: datos?.telefono || '',
      direccionNormalizada: datos?.direccionNormalizada || '',
      comunaNormalizada: datos?.comunaNormalizada || ''
    }));
  } catch (_) {}
}

export async function validarPrimeraCompra(cliente, { timeoutMs = 8000 } = {}) {
  if (!cliente?.telefono || !cliente?.direccionNormalizada || !cliente?.comunaNormalizada || !cliente?.deviceId) {
    return {
      ok: false,
      elegible: false,
      motivo: 'Completa teléfono, dirección y comuna para validar el beneficio.'
    };
  }

  const usadaLocal = beneficioUsadoEnDispositivo();
  if (usadaLocal?.usado) {
    return {
      ok: true,
      elegible: false,
      motivo: 'Este dispositivo ya usó el beneficio de primera compra.',
      coincidencias: ['dispositivo']
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const respuesta = await fetch(ENDPOINT_BENEFICIO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'validar', cliente }),
      credentials: 'omit',
      signal: controller.signal
    });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !data.ok) {
      return {
        ok: false,
        elegible: false,
        motivo: data.motivo || 'No se pudo validar el beneficio en este momento.'
      };
    }
    return {
      ok: true,
      elegible: Boolean(data.elegible),
      token: data.token || '',
      motivo: data.motivo || '',
      coincidencias: Array.isArray(data.coincidencias) ? data.coincidencias : []
    };
  } catch (_) {
    return {
      ok: false,
      elegible: false,
      motivo: 'No se pudo validar el beneficio en este momento.'
    };
  } finally {
    clearTimeout(timer);
  }
}
