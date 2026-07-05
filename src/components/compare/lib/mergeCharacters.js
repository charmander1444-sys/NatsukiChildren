// mergeCharacters.js
// Junta la info de dos fuentes distintas usando "id" como llave común:
//   - kids:  characterKids.json  -> { id, nombre, avatar, ... }
//   - stats: stats.json          -> { id, stats: { fuerza: "B", ... } }
//
// Resultado: [{ id, nombre, avatar, stats }, ...] listo para <Ranking />.

/**
 * Extrae los "paneles" de stats de una entrada de stats.json, normalizando
 * ambos formatos a una lista uniforme:
 *   a) plana:       { fuerza: "B", ... }              -> [{ label: null, stats: {...} }]
 *   b) multi-panel: { panels: [{ nombre, stats }, ...] } -> [{ label: nombre, stats }, ...]
 * @param {object} rawStats
 * @returns {Array<{label: string|null, stats: Record<string,string>}>}
 */
function extractStatsPanels(rawStats) {
  if (!rawStats) return [{ label: null, stats: {} }];
  if (Array.isArray(rawStats.panels)) {
    return rawStats.panels.map((p) => ({
      label: p.nombre ?? p.id ?? null,
      stats: p.stats ?? {},
    }));
  }
  return [{ label: null, stats: rawStats }];
}

/**
 * Normaliza statsData (objeto o array) a un Map<id, panels[]>.
 * @param {object|Array} statsData
 * @returns {Map<string, Array<{label: string|null, stats: Record<string,string>}>>}
 */
function toStatsMap(statsData) {
  if (Array.isArray(statsData)) {
    return new Map(
      statsData.map((entry) => [entry.id, extractStatsPanels(entry.stats)])
    );
  }
  // Objeto keyed por id: { electra: { stats: {...}, historias: [...] }, ... }
  return new Map(
    Object.entries(statsData ?? {}).map(([id, entry]) => [
      id,
      extractStatsPanels(entry.stats),
    ])
  );
}

const KID_TYPES = ["hijo", "hija", "sin_genero"];

/**
 * Normaliza kids a un array plano [{ id, nombre, avatar }, ...],
 * quedándose SOLO con las entradas cuyo "tipo" sea hijo, hija o sin_genero.
 * Soporta 3 formas de entrada:
 *   a) array directo:        [{ id, nombre, avatar, tipo }, ...]
 *   b) envuelto en "personas": { personas: [{ id, nombre, avatar, tipo }, ...] }
 *   c) objeto keyed por id:  { electra: { nombre, avatar, tipo }, ... }
 * @param {object|Array} kids
 * @returns {Array<{id: string, nombre: string, avatar?: string}>}
 */
function toKidsArray(kids) {
  let list;

  if (Array.isArray(kids)) {
    list = kids;
  } else if (Array.isArray(kids?.personas)) {
    list = kids.personas;
  } else {
    // Objeto keyed por id: { electra: { nombre, avatar, tipo }, ... }
    list = Object.entries(kids ?? {}).map(([id, entry]) => ({
      id,
      nombre: entry.nombre,
      avatar: entry.avatar,
      tipo: entry.tipo,
    }));
  }

  return list
    .filter((entry) => KID_TYPES.includes(entry.tipo))
    .map((entry) => ({
      id: entry.id,
      nombre: entry.nombre,
      avatar: entry.avatar,
    }));
}

/**
 * @param {object|Array} kids
 * @param {object|Array} statsData
 * @returns {Array<{id: string, nombre: string, avatar?: string, stats: Record<string, string>}>}
 */
export function mergeCharacters(kids, statsData) {
  const statsById = toStatsMap(statsData);
  const kidsArray = toKidsArray(kids);

  return kidsArray.flatMap((kid) => {
    const panels = statsById.get(kid.id) ?? [{ label: null, stats: {} }];
    const isMulti = panels.length > 1;

    return panels.map((panel) => ({
      id: isMulti ? `${kid.id}-${panel.label}` : kid.id,
      nombre: isMulti ? `${kid.nombre} (${panel.label})` : kid.nombre,
      avatar: kid.avatar,
      stats: panel.stats,
    }));
  });
}