#!/usr/bin/env node
// Validador del catálogo products.json
// Uso: node scripts/validar-catalogo.js

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rutaCatalogo = join(__dirname, '../sushinan/data/products.json');

let errores = 0;
let advertencias = 0;

const error = (msg) => { console.error(`❌ ERROR: ${msg}`); errores++; };
const advertencia = (msg) => { console.warn(`⚠️  AVISO: ${msg}`); advertencias++; };

// Cargar JSON
let data;
try {
  data = JSON.parse(readFileSync(rutaCatalogo, 'utf-8'));
} catch (e) {
  error(`No se pudo leer ${rutaCatalogo}: ${e.message}`);
  process.exit(1);
}

// Estructura raíz
if (!data.negocio) error('Falta la sección "negocio"');
if (!Array.isArray(data.categorias)) error('Falta la sección "categorias" o no es un array');
if (errores > 0) process.exit(1);

// Negocio
const n = data.negocio;
if (!n.nombre) error('negocio.nombre está vacío');
if (!n.telefono_whatsapp) error('negocio.telefono_whatsapp está vacío');
if (!n.catalogo_version) advertencia('negocio.catalogo_version no está definido (se asume 1)');

// Productos
const idsVistos = new Set();
let totalProductos = 0;
let agotados = 0;

for (const [ci, cat] of data.categorias.entries()) {
  if (!cat.id) { error(`Categoría [${ci}] no tiene id`); continue; }
  if (!cat.nombre) error(`Categoría "${cat.id}" no tiene nombre`);
  if (!Array.isArray(cat.productos) || cat.productos.length === 0) {
    advertencia(`Categoría "${cat.id}" está vacía`);
    continue;
  }

  for (const [pi, p] of cat.productos.entries()) {
    totalProductos++;

    // ID
    if (!p.id) { error(`Categoría "${cat.id}" producto [${pi}]: falta id`); }
    else if (idsVistos.has(p.id)) { error(`ID duplicado: "${p.id}"`); }
    else { idsVistos.add(p.id); }

    // Nombre
    if (!p.nombre) error(`"${p.id || `[${pi}]`}": falta nombre`);

    // Precio (solo si está disponible y no es armaTuRoll con precio base)
    if (p.disponible !== false && !p.armaTuRoll) {
      if (p.precio === undefined || p.precio === null) {
        error(`"${p.id}": falta precio`);
      } else if (!Number.isFinite(p.precio) || p.precio < 0) {
        error(`"${p.id}": precio inválido (${p.precio})`);
      }
    }

    // Imagen
    if (p.imagen) {
      const ruta = join(__dirname, '../sushinan', p.imagen);
      if (!existsSync(ruta)) advertencia(`"${p.id}": imagen no encontrada → ${p.imagen}`);
    }

    // Disponibilidad
    if (p.disponible === false) agotados++;

    // Variaciones
    if (p.variaciones) {
      if (Array.isArray(p.variaciones)) {
        p.variaciones.forEach((dim, di) => {
          if (!Array.isArray(dim.opciones) || dim.opciones.length === 0)
            error(`"${p.id}" variación [${di}]: sin opciones`);
          dim.opciones?.forEach(o => {
            if (!Number.isFinite(o.precio) || o.precio < 0)
              error(`"${p.id}" variación [${di}] opción "${o.nombre}": precio inválido (${o.precio})`);
          });
        });
      } else if (p.variaciones.opciones) {
        if (!Array.isArray(p.variaciones.opciones) || p.variaciones.opciones.length === 0)
          error(`"${p.id}": variaciones.opciones vacío`);
      }
    }

    // Arma Tu Roll
    if (p.armaTuRoll) {
      const cfg = p.armaTuRoll;
      if (!Array.isArray(cfg.ingredientes) || cfg.ingredientes.length === 0)
        error(`"${p.id}": armaTuRoll sin ingredientes`);
      if (!Array.isArray(cfg.envolturas) || cfg.envolturas.length === 0)
        error(`"${p.id}": armaTuRoll sin envolturas`);
      if (!Number.isFinite(cfg.maxIngredientes) || cfg.maxIngredientes < 1)
        error(`"${p.id}": armaTuRoll.maxIngredientes inválido`);
      if (!Number.isFinite(p.precio) || p.precio < 0)
        error(`"${p.id}": armaTuRoll falta precio base válido`);
    }
  }
}

// Resumen
console.log(`\n📊 ${totalProductos} productos · ${data.categorias.length} categorías · ${agotados} agotados`);

if (errores === 0 && advertencias === 0) {
  console.log('✅ Catálogo válido — sin errores ni advertencias\n');
} else {
  if (advertencias > 0) console.warn(`${advertencias} advertencia(s)`);
  if (errores > 0) {
    console.error(`${errores} error(es) — corregir antes de publicar\n`);
    process.exit(1);
  }
  console.log('');
}
