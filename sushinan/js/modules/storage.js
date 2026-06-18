const MS_DIA = 86_400_000;

export function guardarConCaducidad(clave, datos, dias = 30) {
  const payload = { datos, expira: Date.now() + dias * MS_DIA };
  localStorage.setItem(clave, JSON.stringify(payload));
}

export function leerConCaducidad(clave) {
  try {
    const payload = JSON.parse(localStorage.getItem(clave) || 'null');
    if (!payload?.datos || !payload?.expira || payload.expira <= Date.now()) {
      localStorage.removeItem(clave);
      return null;
    }
    return payload.datos;
  } catch (_) {
    localStorage.removeItem(clave);
    return null;
  }
}

export function borrarDatosLocales(claves) {
  claves.forEach(clave => localStorage.removeItem(clave));
}
