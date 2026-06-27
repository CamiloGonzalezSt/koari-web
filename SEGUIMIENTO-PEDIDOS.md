# Seguimiento privado de pedidos web

Este sistema registra pedidos generados desde la web sin cambiar el flujo del cliente. El cliente sigue viendo WhatsApp normal; tú recibes una fila privada en una planilla cuando la persona confirma en la web y se abre WhatsApp.

Importante: esto mide **pedidos generados**, no ventas confirmadas. La venta real se confirma dentro de WhatsApp/local.

## Datos que se guardan

Para evitar guardar información sensible, el registro no envía nombre, teléfono ni dirección. Guarda:

- fecha y hora
- total, subtotal y envío
- delivery/retiro
- comuna
- método de pago
- productos, cantidades y precios
- si tenía nota, sin guardar el texto de la nota
- promociones aplicadas

## Cómo activarlo con una planilla privada

1. Crea una Google Sheet en tu cuenta personal.
2. En la planilla, ve a **Extensiones > Apps Script**.
3. Pega este código:

```js
const SECRET = 'CAMBIA_ESTE_TEXTO_POR_UN_SECRETO_LARGO';
const HOJA = 'Pedidos web';

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  if (SECRET && data.secret !== SECRET) {
    return json({ ok: false, error: 'unauthorized' });
  }

  const pedido = data.pedido || {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA)
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet(HOJA);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
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
      'Página'
    ]);
  }

  const productos = (pedido.items || [])
    .map(item => `${item.cantidad}x ${item.nombre} (${item.precioUnitario})`)
    .join('\n');

  const promociones = (pedido.items || [])
    .filter(item => item.promocion && item.promocion.activa)
    .map(item => `${item.nombre}: ${item.promocion.descuento} - ${item.promocion.vigencia}`)
    .join('\n');

  const programacion = pedido.programacion?.tipo === 'programado'
    ? `${pedido.programacion.fecha} ${pedido.programacion.hora}`
    : 'Lo antes posible';

  const preferencias = [
    pedido.preferencias?.palillos ? `Palillos: ${pedido.preferencias.palillos}` : '',
    pedido.preferencias?.sinSoya ? 'Sin soya' : '',
    pedido.preferencias?.sinWasabi ? 'Sin wasabi' : '',
    pedido.preferencias?.notaCliente ? 'Con nota' : ''
  ].filter(Boolean).join(', ');

  sheet.appendRow([
    pedido.recibidoEn || new Date().toISOString(),
    pedido.orderId || '',
    pedido.evento || '',
    pedido.modalidad || '',
    pedido.comuna || '',
    pedido.pago || '',
    programacion,
    pedido.subtotal || 0,
    pedido.envio || 0,
    pedido.total || 0,
    pedido.cantidadItems || 0,
    pedido.incluyeBebidas ? 'Sí' : 'No',
    preferencias,
    productos,
    promociones,
    pedido.pagina || ''
  ]);

  return json({ ok: true });
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. En Apps Script, toca **Implementar > Nueva implementación**.
5. Tipo: **Aplicación web**.
6. Ejecutar como: **Yo**.
7. Quién tiene acceso: **Cualquier persona**.
8. Copia la URL de la aplicación web.
9. En Vercel, agrega estas variables de entorno:

```txt
PEDIDOS_WEBHOOK_URL=https://script.google.com/macros/s/XXXXX/exec
PEDIDOS_WEBHOOK_SECRET=CAMBIA_ESTE_TEXTO_POR_UN_SECRETO_LARGO
```

10. Vuelve a desplegar el sitio.

Si esas variables no existen, el sitio no se cae: simplemente omite el registro.
