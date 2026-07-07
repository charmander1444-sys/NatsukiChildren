// heightUtils.js
// Funciones puras para extraer, agrupar y escalar las alturas de los personajes.
// No dependen de Astro, así que son fáciles de testear o reutilizar.

/**
 * Extrae un número en cm a partir de un string tipo "163cm" o "180 cm".
 */
function parseCm(valor) {
  if (typeof valor !== "string") return null;
  const match = valor.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

/**
 * Normaliza el campo `tamano` de un personaje a una lista de items
 * homogénea: [{ nombre, valor, cm }, ...]
 * Soporta tanto el formato string directo ("163cm") como el de
 * múltiples formas ({ items: [{ nombre, valor }] }).
 */
function toItems(tamano) {
  if (!tamano) return [];

  if (typeof tamano === "string") {
    const cm = parseCm(tamano);
    return cm != null ? [{ nombre: "", valor: tamano, cm }] : [];
  }

  if (Array.isArray(tamano.items)) {
    return tamano.items
      .map((it) => ({ nombre: it.nombre ?? "", valor: it.valor, cm: parseCm(it.valor) }))
      .filter((it) => it.cm != null);
  }

  return [];
}

export function getHeightItems(personaje) {
  return toItems(personaje?.tamano);
}

/** Se mantiene por compatibilidad con otras partes del proyecto (ej. tablas de ranking). */
export function getPrimaryHeightCm(personaje) {
  return getHeightItems(personaje)[0]?.cm ?? null;
}

export function getPrimaryHeightLabel(personaje) {
  return getHeightItems(personaje)[0]?.valor ?? null;
}

export const TIPO_LABELS = {
  hijo: "Hijos",
  hija: "Hijas",
  sin_genero: "Sin género",
};

export const TIPO_COLORS = {
  hijo: { from: "#38bdf8", to: "#0ea5e9" }, // azul
  hija: { from: "#f472b6", to: "#db2777" }, // rosa
  sin_genero: { from: "#a78bfa", to: "#7c3aed" }, // violeta
};

function toArray(personajes) {
  if (Array.isArray(personajes)) return personajes;

  if (personajes && typeof personajes === "object") {
    const posiblesClaves = ["personas", "characters", "personajes", "items", "data", "kids"];
    for (const clave of posiblesClaves) {
      if (Array.isArray(personajes[clave])) return personajes[clave];
    }
    const valores = Object.values(personajes);
    if (valores.every((v) => v && typeof v === "object")) return valores;
  }

  console.warn("[heightUtils] 'personajes' no es un array iterable:", personajes);
  return [];
}

/**
 * NUEVO: en vez de una barra por personaje, genera una "entrada" (entry)
 * por cada FORMA de altura que tenga el personaje. Un personaje con 3
 * formas (ej. Phoebe: Normal/Híbrido, Dragón terrestre, Dragón) genera
 * 3 entries independientes, cada una con su propio cm — así cada forma
 * se posiciona por separado al ordenar/filtrar por altura.
 *
 * Cada entry: { id, personaje, tipo, cm, valor, formNombre, hasMultipleForms }
 */
export function buildHeightEntries(personajesInput = []) {
  const personajes = toArray(personajesInput);
  const ordenTipos = ["hijo", "hija", "sin_genero"];
  const grupos = { hijo: [], hija: [], sin_genero: [] };

  for (const personaje of personajes) {
    const tipo = personaje.tipo;
    if (!Object.prototype.hasOwnProperty.call(grupos, tipo)) continue;

    const items = getHeightItems(personaje);
    if (items.length === 0) continue; // sin dato de altura -> se omite

    grupos[tipo].push({ personaje, items });
  }

  const entries = [];
  for (const tipo of ordenTipos) {
    for (const { personaje, items } of grupos[tipo]) {
      const hasMultipleForms = items.length > 1;
      items.forEach((item, idx) => {
        entries.push({
          id: `${personaje.id ?? personaje.nombre}__${idx}`,
          personaje,
          tipo,
          cm: item.cm,
          valor: item.valor,
          formNombre: item.nombre,
          hasMultipleForms,
        });
      });
    }
  }

  return entries;
}

/**
 * Calcula una escala ÚNICA (px por cm) a partir de TODAS las entries
 * (ya explotadas por forma), para que la barra más alta de cualquier
 * forma de cualquier personaje ocupe maxBarPx.
 */
export function computeScaleForEntries(entries = [], { maxBarPx = 520, minBarPx = 36 } = {}) {
  const alturas = entries.map((e) => e.cm).filter((v) => v != null);
  const max = alturas.length ? Math.max(...alturas) : 1;
  const pixelsPerCm = max > 0 ? maxBarPx / max : 1;

  return { pixelsPerCm, minBarPx, maxCm: max };
}