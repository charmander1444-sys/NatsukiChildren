// src/components/calendario/utils.js
// Utilidades compartidas por los componentes del calendario:
// parseo de "cumpleanos" en español y agrupación de personajes por día.

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Tipos de "personas" que cuentan como hijos para el calendario.
// El resto (raiz, padre, madre, conexion) se ignora aunque esté en el mismo archivo.
export const TIPOS_HIJOS = ["hijo", "hija", "sin_genero"];

/**
 * @typedef {Object} Persona
 * @property {string} id
 * @property {string} nombre
 * @property {"raiz"|"padre"|"madre"|"conexion"|"hijo"|"hija"|"sin_genero"} tipo
 * @property {string} [avatar]
 * @property {string} [cumpleanos] - formato: "11 de Noviembre"
 */

/**
 * @typedef {Persona & { dia: number, mesIndex: number }} KidConFecha
 */

const normalize = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Extrae únicamente los personajes "hijos" (hijo/hija/sin_genero) que además
 * tengan cumpleanos definido, a partir del archivo completo { personas: [...] }.
 * Personajes como padre/madre/raiz/conexion, o hijos sin cumpleanos aún
 * cargado, se descartan para el calendario.
 * @param {{ personas: Persona[] }} data
 * @returns {Persona[]}
 */
export function obtenerHijosConCumpleanos(data) {
  const personas = data?.personas ?? [];
  return personas.filter(
    (p) => TIPOS_HIJOS.includes(p.tipo) && Boolean(p.cumpleanos),
  );
}

/**
 * Convierte "11 de Noviembre" -> { dia: 11, mesIndex: 10 }
 * @param {string} cumpleanos
 * @returns {{ dia: number, mesIndex: number } | null}
 */
export function parseCumpleanos(cumpleanos) {
  if (!cumpleanos) return null;
  const match = cumpleanos.match(/(\d{1,2})\s+de\s+([a-zA-ZñÑáéíóúÁÉÍÓÚ]+)/i);
  if (!match) return null;

  const dia = parseInt(match[1], 10);
  const mesNombre = normalize(match[2]);
  const mesIndex = MESES.findIndex((m) => normalize(m) === mesNombre);

  if (mesIndex === -1 || Number.isNaN(dia)) return null;
  return { dia, mesIndex };
}

/**
 * Cantidad de días a renderizar por mes (Febrero = 29 para permitir cumpleaños el 29).
 * @param {number} mesIndex
 * @returns {number}
 */
export function diasDelMes(mesIndex) {
  const dias = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dias[mesIndex] ?? 30;
}

/**
 * Agrupa personajes por clave "mesIndex-dia" para acceso rápido en el grid.
 * @param {Kid[]} kids
 * @returns {Record<string, KidConFecha[]>}
 */
export function agruparPorDia(kids) {
  const grupos = {};

  for (const kid of kids) {
    if (!kid.cumpleanos) continue;
    const fecha = parseCumpleanos(kid.cumpleanos);
    if (!fecha) continue;

    const key = `${fecha.mesIndex}-${fecha.dia}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push({ ...kid, ...fecha });
  }

  return grupos;
}

/**
 * Lista plana de personajes con fecha resuelta, útil para el buscador.
 * @param {Kid[]} kids
 * @returns {KidConFecha[]}
 */
export function listaConFecha(kids) {
  return kids
    .map((kid) => {
      const fecha = kid.cumpleanos ? parseCumpleanos(kid.cumpleanos) : null;
      if (!fecha) return null;
      return { ...kid, ...fecha };
    })
    .filter((k) => k !== null);
}