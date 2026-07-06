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
 * Un personaje puede tener:
 *  - tamano: "163cm"                         (string directo)
 *  - tamano: { items: [{ nombre, valor }] }  (varias formas, se usa la primera como base)
 * Devuelve el valor numérico en cm de su forma "base"/principal.
 */
export function getPrimaryHeightCm(personaje) {
  const tamano = personaje?.tamano;
  if (!tamano) return null;

  if (typeof tamano === "string") {
    return parseCm(tamano);
  }

  if (Array.isArray(tamano.items) && tamano.items.length > 0) {
    return parseCm(tamano.items[0].valor);
  }

  return null;
}

/**
 * Igual que getPrimaryHeightCm pero devuelve el texto original ("163cm")
 * para mostrarlo tal cual en la interfaz.
 */
export function getPrimaryHeightLabel(personaje) {
  const tamano = personaje?.tamano;
  if (!tamano) return null;

  if (typeof tamano === "string") return tamano;

  if (Array.isArray(tamano.items) && tamano.items.length > 0) {
    return tamano.items[0].valor;
  }

  return null;
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

/**
 * Agrupa personajes por tipo (hijo / hija / sin_genero), descartando
 * los que no tienen ningún dato de altura utilizable.
 */
function toArray(personajes) {
  if (Array.isArray(personajes)) return personajes;

  if (personajes && typeof personajes === "object") {
    // Soporta JSON envuelto en una propiedad, ej: { characters: [...] } o { personajes: [...] }
    const posiblesClaves = ["personas", "characters", "personajes", "items", "data", "kids"];
    for (const clave of posiblesClaves) {
      if (Array.isArray(personajes[clave])) return personajes[clave];
    }
    // Último recurso: si es un objeto de objetos { phoebe: {...}, otro: {...} }
    const valores = Object.values(personajes);
    if (valores.every((v) => v && typeof v === "object")) return valores;
  }

  console.warn("[heightUtils] 'personajes' no es un array iterable:", personajes);
  return [];
}

export function groupByTipo(personajesInput = []) {
  const personajes = toArray(personajesInput);
  const grupos = { hijo: [], hija: [], sin_genero: [] };

  for (const personaje of personajes) {
    const tipo = personaje.tipo;
    // Solo nos interesan hijo / hija / sin_genero para este gráfico.
    // Otros tipos (madre, raiz, conexion, etc.) se ignoran a propósito.
    if (!Object.prototype.hasOwnProperty.call(grupos, tipo)) continue;

    const cm = getPrimaryHeightCm(personaje);
    if (cm == null) continue; // sin dato de altura -> se omite del gráfico

    grupos[tipo].push(personaje);
  }

  return grupos;
}

/**
 * Calcula una escala ÚNICA (px por cm) a partir de TODOS los personajes
 * que se van a graficar, para que la comparación entre grupos sea justa
 * y las diferencias de altura se vean claramente marcadas.
 */
export function computeScale(personajesInput = [], { maxBarPx = 520, minBarPx = 36 } = {}) {
  const personajes = toArray(personajesInput);
  const alturas = personajes.map(getPrimaryHeightCm).filter((v) => v != null);
  const max = alturas.length ? Math.max(...alturas) : 1;
  const pixelsPerCm = max > 0 ? maxBarPx / max : 1;

  return { pixelsPerCm, minBarPx, maxCm: max };
}