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
  if (!cliente.telefono || !cliente.direccionNormalizada || !cliente.comunaNormalizada || !cliente.deviceId) {
    return { ok: false, elegible: false, motivo: 'Faltan datos para validar el beneficio.' };
  }

  const sheet = obtenerHoja(HOJA_BENEFICIOS, HEADERS_BENEFICIOS);
  const rows = leerObjetos(sheet);
  const coincidencias = [];

  rows.forEach(row => {
    const estado = String(row['Estado'] || '').toLowerCase();
    if (estado && estado !== 'usado') return;

    if (String(row['Teléfono'] || '') === cliente.telefono) coincidencias.push('telefono');
    if (String(row['Device ID'] || '') === cliente.deviceId) coincidencias.push('dispositivo');
    if (
      String(row['Dirección normalizada'] || '') === cliente.direccionNormalizada &&
      String(row['Comuna normalizada'] || '') === cliente.comunaNormalizada
    ) coincidencias.push('direccion');
  });

  const unicas = [...new Set(coincidencias)];
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

function registrarPedido(pedido) {
  const sheet = obtenerHoja(HOJA_PEDIDOS, HEADERS_PEDIDOS);
  const beneficio = pedido.beneficioPrimeraCompra || {};
  const clienteBeneficio = normalizarClienteBeneficio(beneficio.cliente || {});

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

  appendObjeto(sheet, HEADERS_PEDIDOS, {
    'Recibido': pedido.recibidoEn || new Date().toISOString(),
    'ID pedido': pedido.orderId || '',
    'Evento': pedido.evento || '',
    'Modalidad': pedido.modalidad || '',
    'Comuna': pedido.comuna || '',
    'Pago': pedido.pago || '',
    'Programación': programacion,
    'Subtotal': pedido.subtotal || 0,
    'Envío': pedido.envio || 0,
    'Total': pedido.total || 0,
    'Cantidad items': pedido.cantidadItems || 0,
    'Incluye bebidas': pedido.incluyeBebidas ? 'Sí' : 'No',
    'Preferencias': preferencias,
    'Productos': productos,
    'Promociones': promociones,
    'Beneficio primera compra': beneficio.aplicado ? 'Sí' : 'No',
    'Ahorro beneficio': beneficio.aplicado ? beneficio.ahorro || 0 : 0,
    'Teléfono beneficio': beneficio.aplicado ? clienteBeneficio.telefono : '',
    'Nombre beneficio': beneficio.aplicado ? clienteBeneficio.nombre : '',
    'Dirección beneficio': beneficio.aplicado ? clienteBeneficio.direccion : '',
    'Device ID beneficio': beneficio.aplicado ? clienteBeneficio.deviceId : '',
    'Página': pedido.pagina || ''
  });

  if (beneficio.aplicado) {
    registrarUsoBeneficio(pedido, beneficio, clienteBeneficio);
  }

  return { ok: true };
}

function registrarUsoBeneficio(pedido, beneficio, cliente) {
  if (!cliente.telefono || !cliente.direccionNormalizada || !cliente.comunaNormalizada || !cliente.deviceId) return;

  const sheet = obtenerHoja(HOJA_BENEFICIOS, HEADERS_BENEFICIOS);
  const rows = leerObjetos(sheet);
  const existePedido = rows.some(row => String(row['ID pedido'] || '') === String(pedido.orderId || ''));
  if (existePedido) return;

  appendObjeto(sheet, HEADERS_BENEFICIOS, {
    'Fecha uso': new Date().toISOString(),
    'ID pedido': pedido.orderId || '',
    'Teléfono': cliente.telefono,
    'Nombre': cliente.nombre,
    'Nombre normalizado': cliente.nombreNormalizado,
    'Dirección': cliente.direccion,
    'Dirección normalizada': cliente.direccionNormalizada,
    'Comuna': cliente.comuna,
    'Comuna normalizada': cliente.comunaNormalizada,
    'Device ID': cliente.deviceId,
    'Token': beneficio.token || '',
    'Ahorro': beneficio.ahorro || 0,
    'Estado': 'usado'
  });
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
