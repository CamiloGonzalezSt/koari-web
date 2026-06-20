const ZONA_HORARIA = 'America/Santiago';

export const REGLAS_PROMOCIONES = Object.freeze([
  {
    id: 'promo-5',
    dias: [1, 2, 3, 4],
    descuento: 20,
    precioRegular: 14990,
    precioOferta: 11990,
    vigencia: 'Lunes a jueves'
  },
  {
    id: 'promo-7',
    dias: [1, 2, 3, 4],
    descuento: 20,
    precioRegular: 15990,
    precioOferta: 12790,
    vigencia: 'Lunes a jueves'
  },
  {
    id: 'promo-8',
    dias: [5, 6],
    descuento: 10,
    precioRegular: 16990,
    precioOferta: 15290,
    vigencia: 'Solo viernes y sábado'
  },
  {
    id: 'promo-nan-60',
    dias: [5, 6],
    descuento: 10,
    precioRegular: 16000,
    precioOferta: 14400,
    vigencia: 'Solo viernes y sábado'
  },
  {
    id: 'promo-10',
    dias: [0],
    descuento: 15,
    precioRegular: 15500,
    precioOferta: 13170,
    vigencia: 'Solo por hoy domingo'
  },
  {
    id: 'promo-11',
    dias: [0],
    descuento: 15,
    precioRegular: 18500,
    precioOferta: 16570,
    vigencia: 'Solo por hoy domingo'
  }
]);

const INDICE_DIA = Object.freeze({
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
});

export function obtenerDiaChile(fecha = new Date()) {
  const dia = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    weekday: 'short'
  }).format(fecha);
  return INDICE_DIA[dia];
}

export function obtenerFechaChileISO(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(fecha);
  const valor = tipo => partes.find(parte => parte.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function aplicarPromocionesProgramadas(data, fecha = new Date()) {
  if (!Array.isArray(data?.categorias)) return false;

  const dia = obtenerDiaChile(fecha);
  const productos = new Map(
    data.categorias.flatMap(categoria => categoria.productos || []).map(producto => [producto.id, producto])
  );
  let cambio = false;

  REGLAS_PROMOCIONES.forEach(regla => {
    const producto = productos.get(regla.id);
    if (!producto) return;

    const activa = regla.dias.includes(dia);
    const precio = activa ? regla.precioOferta : regla.precioRegular;
    if (producto.precio !== precio || producto.promocionProgramada?.activa !== activa) cambio = true;

    producto.precio = precio;
    producto.promocionProgramada = {
      activa,
      descuento: regla.descuento,
      precioRegular: regla.precioRegular,
      precioOferta: regla.precioOferta,
      vigencia: regla.vigencia
    };
  });

  return cambio;
}

export function iniciarRelojPromociones(data, alCambiar, intervaloMs = 60_000) {
  let fechaAplicada = obtenerFechaChileISO();
  return setInterval(() => {
    const fechaActual = obtenerFechaChileISO();
    if (fechaActual === fechaAplicada) return;
    fechaAplicada = fechaActual;
    aplicarPromocionesProgramadas(data);
    alCambiar?.();
  }, intervaloMs);
}
