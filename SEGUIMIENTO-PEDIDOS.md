# Seguimiento privado de pedidos web

Este sistema registra pedidos generados desde la web sin cambiar el flujo del cliente. El cliente sigue viendo WhatsApp normal; tú recibes una fila privada en una planilla cuando la persona confirma en la web y se abre WhatsApp.

Importante: esto mide **pedidos generados**, no ventas confirmadas. La venta real se confirma dentro de WhatsApp/local.

## Datos que se guardan

Para medir pedidos, el registro base guarda:

- fecha y hora
- total, subtotal y envío
- delivery/retiro
- comuna
- método de pago
- productos, cantidades y precios
- si tenía nota, sin guardar el texto de la nota
- promociones aplicadas

Para el beneficio de **despacho gratis en primera compra**, sí se guardan datos necesarios para validar abuso:

- teléfono normalizado
- nombre
- dirección normalizada
- comuna
- ID del dispositivo/navegador
- fecha de uso del beneficio
- ahorro aplicado

## Cómo activarlo con una planilla privada

1. Crea una Google Sheet en tu cuenta personal.
2. En la planilla, ve a **Extensiones > Apps Script**.
3. Pega el código completo de `scripts/apps-script-pedidos.gs`.

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

Si esas variables no existen, el sitio no se cae: simplemente omite el registro y no aplica el beneficio automático.

## Despacho gratis en primera compra

La web valida el beneficio contra la misma Apps Script:

- Si el teléfono ya usó el beneficio, no aplica.
- Si el dispositivo ya usó el beneficio, no aplica.
- Si la dirección + comuna ya usaron el beneficio, no aplica.
- Si no hay coincidencias, aplica envío gratis.

El beneficio se marca como usado cuando el cliente toca **Continuar a WhatsApp**.
