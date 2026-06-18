import { fechaChileISO, horaChile } from './utils.js';

export function obtenerInfoHorario(negocio, fecha = new Date()) {
  const horario = negocio.horarios_pedido;
  if (!horario) return null;
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(fecha);
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dia = dias[partes.find(p => p.type === 'weekday')?.value];
  const hora = partes.find(p => p.type === 'hour')?.value;
  const minuto = partes.find(p => p.type === 'minute')?.value;
  if (!hora || !minuto) return null;
  const rango = horario[String(dia)];
  const actual = Number(hora) * 60 + Number(minuto);
  const aMinutos = valor => { const [h, m] = valor.split(':').map(Number); return h * 60 + m; };
  const abierto = Boolean(rango) && actual >= aMinutos(rango[0]) && actual <= aMinutos(rango[1]);
  return { dia, actual, rango, abierto, aMinutos };
}

export function textoProximaAtencion(negocio, info) {
  if (info.rango && info.actual < info.aMinutos(info.rango[0])) {
    return `Atendemos hoy de ${info.rango[0]} a ${info.rango[1]}.`;
  }
  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  for (let avance = 1; avance <= 7; avance++) {
    const dia = (info.dia + avance) % 7;
    const rango = negocio.horarios_pedido[String(dia)];
    if (rango) return `Próxima atención: ${nombres[dia]} de ${rango[0]} a ${rango[1]}.`;
  }
  return negocio.horario || 'Consulta nuestro horario antes de pedir.';
}

export function validarProgramacion(negocio, fecha, hora) {
  if (!fecha || !hora) return 'Selecciona la fecha y hora del pedido.';
  const hoy = fechaChileISO();
  if (fecha < hoy) return 'La fecha del pedido no puede estar en el pasado.';
  if (fecha === hoy && hora <= horaChile()) return 'La hora programada debe ser posterior a la hora actual.';
  const dia = new Date(`${fecha}T12:00:00`).getDay();
  const rango = negocio.horarios_pedido?.[String(dia)];
  if (!rango) return 'El local no recibe pedidos programados para ese día.';
  if (hora < rango[0] || hora > rango[1]) return `Para ese día atendemos de ${rango[0]} a ${rango[1]}.`;
  return '';
}
