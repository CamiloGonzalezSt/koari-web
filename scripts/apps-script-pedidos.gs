const SECRET = 'CAMBIA_ESTE_TEXTO_POR_EL_MISMO_SECRETO_DE_VERCEL';
const HOJA_PEDIDOS = 'Pedidos web';
const HOJA_BENEFICIOS = 'Beneficios primera compra';

const HEADERS_PEDIDOS = [
  'Recibido',
  'ID pedido',
  'Evento',
  'Modalidad',
  'Comuna',
  'Pago',
  'Programación',
  'Subtotal',
  'Envío',
  'Total',
  'Cantidad items',
  'Incluye bebidas',
  'Preferencias',
  'Productos',
  'Promociones',
  'Beneficio primera compra',
  'Ahorro beneficio',
  'Teléfono beneficio',
  'Nombre beneficio',
  'Dirección beneficio',
  'Device ID beneficio',
  'Página'
];

const HEADERS_BENEFICIOS = [
  'Fecha uso',
  'ID pedido',
  'Teléfono',
  'Nombre',
  'Nombre normalizado',
  'Dirección',
  'Dirección normalizada',
  'Comuna',
  'Comuna normalizada',
  'Device ID',
  'Token',
  'Ahorro',
  'Estado'
];

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  if (SECRET && data.secret !== SECRET) {
    return json({ ok: false, error: 'unauthorized', motivo: 'Secreto inválido.' });
  }

  if (data.accion === 'validar_beneficio_primera_compra') {
    return json(validarBeneficioPrimeraCompra(data.beneficio || {}));
  }

  if (data.pedido) {
    return json(registrarPedido(data.pedido));
  }

  return json({ ok: false, error: 'unknown-action', motivo: 'Acción no reconocida.' });
}

function validarBeneficioPrimeraCompra(beneficio) {
  const cliente = normalizarClienteBeneficio(beneficio.cliente || {});
  if (!tieneDatosClienteBeneficio(cliente)) {
    return { ok: false, elegible: false, motivo: 'Faltan datos para validar el beneficio.' };
  }

  const unicas = obtenerCoincidenciasBeneficio(cliente);
  if (unicas.length) {
    return {
      ok: true,
      elegible: false,
      coincidencias: unicas,
      motivo: 'El despacho gratis de primera compra ya fue usado con estos datos.'
    };
  }

  return {
    ok: true,
    elegible: true,
    token: crearTokenBeneficio(),
    coincidencias: [],
    motivo: 'Beneficio disponible.'
  };
}

function tieneDatosClienteBeneficio(cliente) {
  return Boolean(cliente.telefono && cliente.direccionNormalizada && cliente.comunaNormalizada && cliente.deviceId);
}

function obtenerCoincidenciasBeneficio(cliente, opciones) {
  const sheet = obtenerHoja(HOJA_BENEFICIOS, HEADERS_BENEFICIOS);
  const rows = leerObjetos(sheet);
  const coincidencias = [];
  const pedidoExcluido = texto(opciones && opciones.excluirPedidoId, 80);

  rows.forEach(row => {
    const estado = String(row[HEADERS_BENEFICIOS[12]] || '').toLowerCase();
    if (estado && estado !== 'usado') return;
    if (pedidoExcluido && String(row[HEADERS_BENEFICIOS[1]] || '') === pedidoExcluido) return;

    if (String(row[HEADERS_BENEFICIOS[2]] || '') === cliente.telefono) coincidencias.push('telefono');
    if (String(row[HEADERS_BENEFICIOS[9]] || '') === cliente.deviceId) coincidencias.push('dispositivo');
    if (
      String(row[HEADERS_BENEFICIOS[6]] || '') === cliente.direccionNormalizada &&
      String(row[HEADERS_BENEFICIOS[8]] || '') === cliente.comunaNormalizada
    ) coincidencias.push('direccion');
  });

  return [...new Set(coincidencias)];
}
function registrarPedido(pedido) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    return registrarPedidoConLock(pedido);
  } finally {
    lock.releaseLock();
  }
}

function registrarPedidoConLock(pedido) {
  const sheet = obtenerHoja(HOJA_PEDIDOS, HEADERS_PEDIDOS);
  const pedidoId = String(pedido.orderId || '');
  if (pedidoId) {
    const existePedido = leerObjetos(sheet).some(row => String(row[HEADERS_PEDIDOS[1]] || '') === pedidoId);
    if (existePedido) return { ok: true, duplicado: true, motivo: 'Pedido ya registrado.' };
  }

  const beneficio = pedido.beneficioPrimeraCompra || {};
  const clienteBeneficio = normalizarClienteBeneficio(beneficio.cliente || {});
  const beneficioSolicitado = Boolean(beneficio.aplicado);
  const beneficioConDatos = tieneDatosClienteBeneficio(clienteBeneficio);
  const coincidenciasBeneficio = beneficioSolicitado && beneficioConDatos
    ? obtenerCoincidenciasBeneficio(clienteBeneficio)
    : [];
  const beneficioAceptado = beneficioSolicitado && beneficioConDatos && coincidenciasBeneficio.length === 0;

  const productos = (pedido.items || [])
    .map(item => `${item.cantidad}x ${item.nombre} (${item.precioUnitario})`)
    .join('\n');

  const promociones = (pedido.items || [])
    .filter(item => item.promocion && item.promocion.activa)
    .map(item => `${item.nombre}: ${item.promocion.descuento} - ${item.promocion.vigencia}`)
    .join('\n');

  const programacion = pedido.programacion && pedido.programacion.tipo === 'programado'
    ? `${pedido.programacion.fecha} ${pedido.programacion.hora}`
    : 'Lo antes posible';

  const preferencias = [
    pedido.preferencias && pedido.preferencias.palillos ? `Palillos: ${pedido.preferencias.palillos}` : '',
    pedido.preferencias && pedido.preferencias.sinSoya ? 'Sin soya' : '',
    pedido.preferencias && pedido.preferencias.sinWasabi ? 'Sin wasabi' : '',
    pedido.preferencias && pedido.preferencias.notaCliente ? 'Con nota' : ''
  ].filter(Boolean).join(', ');

  const fila = {};
  fila[HEADERS_PEDIDOS[0]] = pedido.recibidoEn || new Date().toISOString();
  fila[HEADERS_PEDIDOS[1]] = pedido.orderId || '';
  fila[HEADERS_PEDIDOS[2]] = pedido.evento || '';
  fila[HEADERS_PEDIDOS[3]] = pedido.modalidad || '';
  fila[HEADERS_PEDIDOS[4]] = pedido.comuna || '';
  fila[HEADERS_PEDIDOS[5]] = pedido.pago || '';
  fila[HEADERS_PEDIDOS[6]] = programacion;
  fila[HEADERS_PEDIDOS[7]] = pedido.subtotal || 0;
  fila[HEADERS_PEDIDOS[8]] = pedido.envio || 0;
  fila[HEADERS_PEDIDOS[9]] = pedido.total || 0;
  fila[HEADERS_PEDIDOS[10]] = pedido.cantidadItems || 0;
  fila[HEADERS_PEDIDOS[11]] = pedido.incluyeBebidas ? 'Sí' : 'No';
  fila[HEADERS_PEDIDOS[12]] = preferencias;
  fila[HEADERS_PEDIDOS[13]] = productos;
  fila[HEADERS_PEDIDOS[14]] = promociones;
  fila[HEADERS_PEDIDOS[15]] = beneficioAceptado
    ? 'Sí'
    : (beneficioSolicitado ? `Bloqueado repetido: ${coincidenciasBeneficio.join(', ') || 'sin datos'}` : 'No');
  fila[HEADERS_PEDIDOS[16]] = beneficioAceptado ? beneficio.ahorro || 0 : 0;
  fila[HEADERS_PEDIDOS[17]] = beneficioSolicitado ? clienteBeneficio.telefono : '';
  fila[HEADERS_PEDIDOS[18]] = beneficioSolicitado ? clienteBeneficio.nombre : '';
  fila[HEADERS_PEDIDOS[19]] = beneficioSolicitado ? clienteBeneficio.direccion : '';
  fila[HEADERS_PEDIDOS[20]] = beneficioSolicitado ? clienteBeneficio.deviceId : '';
  fila[HEADERS_PEDIDOS[21]] = pedido.pagina || '';

  appendObjeto(sheet, HEADERS_PEDIDOS, fila);

  if (beneficioAceptado) {
    registrarUsoBeneficio(pedido, beneficio, clienteBeneficio);
  }

  return {
    ok: true,
    beneficioAceptado,
    beneficioBloqueado: beneficioSolicitado && !beneficioAceptado,
    coincidenciasBeneficio
  };
}
function registrarUsoBeneficio(pedido, beneficio, cliente) {
  if (!tieneDatosClienteBeneficio(cliente)) return;

  const sheet = obtenerHoja(HOJA_BENEFICIOS, HEADERS_BENEFICIOS);
  const rows = leerObjetos(sheet);
  const existePedido = rows.some(row => String(row[HEADERS_BENEFICIOS[1]] || '') === String(pedido.orderId || ''));
  if (existePedido) return;

  const coincidencias = obtenerCoincidenciasBeneficio(cliente);
  if (coincidencias.length) return;

  const fila = {};
  fila[HEADERS_BENEFICIOS[0]] = new Date().toISOString();
  fila[HEADERS_BENEFICIOS[1]] = pedido.orderId || '';
  fila[HEADERS_BENEFICIOS[2]] = cliente.telefono;
  fila[HEADERS_BENEFICIOS[3]] = cliente.nombre;
  fila[HEADERS_BENEFICIOS[4]] = cliente.nombreNormalizado;
  fila[HEADERS_BENEFICIOS[5]] = cliente.direccion;
  fila[HEADERS_BENEFICIOS[6]] = cliente.direccionNormalizada;
  fila[HEADERS_BENEFICIOS[7]] = cliente.comuna;
  fila[HEADERS_BENEFICIOS[8]] = cliente.comunaNormalizada;
  fila[HEADERS_BENEFICIOS[9]] = cliente.deviceId;
  fila[HEADERS_BENEFICIOS[10]] = beneficio.token || '';
  fila[HEADERS_BENEFICIOS[11]] = beneficio.ahorro || 0;
  fila[HEADERS_BENEFICIOS[12]] = 'usado';

  appendObjeto(sheet, HEADERS_BENEFICIOS, fila);
}
function normalizarClienteBeneficio(input) {
  return {
    nombre: texto(input.nombre, 120),
    nombreNormalizado: normalizarTexto(input.nombreNormalizado || input.nombre, 120),
    telefono: String(input.telefono || '').replace(/\D/g, ''),
    direccion: texto(input.direccion, 180),
    direccionNormalizada: normalizarDireccion(input.direccionNormalizada || input.direccion),
    comuna: texto(input.comuna, 80),
    comunaNormalizada: normalizarTexto(input.comunaNormalizada || input.comuna, 80),
    deviceId: texto(input.deviceId, 80)
  };
}

function obtenerHoja(nombre, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  asegurarHeaders(sheet, headers);
  return sheet;
}

function asegurarHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const actuales = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const faltantes = headers.filter(header => !actuales.includes(header));
  if (faltantes.length) {
    sheet.getRange(1, actuales.length + 1, 1, faltantes.length).setValues([faltantes]);
  }
}

function leerObjetos(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(row => {
    const obj = {};
    headers.forEach((header, index) => { obj[header] = row[index]; });
    return obj;
  });
}

function appendObjeto(sheet, headers, obj) {
  asegurarHeaders(sheet, headers);
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(currentHeaders.map(header => obj[header] !== undefined ? obj[header] : ''));
}

function normalizarTexto(valor, largo) {
  return texto(valor, largo)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarDireccion(valor) {
  return normalizarTexto(valor, 180)
    .replace(/\bavenida\b/g, 'av')
    .replace(/\bavda\b/g, 'av')
    .replace(/\bpasaje\b/g, 'psje')
    .replace(/\bdepartamento\b/g, 'depto')
    .replace(/\bdpto\b/g, 'depto')
    .replace(/\s+/g, ' ')
    .trim();
}

function texto(valor, largo) {
  return String(valor || '').trim().slice(0, largo);
}

function crearTokenBeneficio() {
  return `BPC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
