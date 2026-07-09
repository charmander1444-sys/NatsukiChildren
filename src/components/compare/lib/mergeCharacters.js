// mergeCharacters.js
import { toRankLetter } from "./statsConfig.js";
import { getPuntuacionTotal } from "../../../data/lib/stats.js";

function toKidsArray(kids) {
  return kids?.personas ?? [];
}

function toStatsMap(statsData) {
  const map = new Map();

  for (const [id, data] of Object.entries(statsData ?? {})) {
    let panels;

    if (data?.stats?.panels) {
      panels = data.stats.panels.map((panel) => ({
        label: panel.nombre || panel.id || null,
        stats: panel.stats || {},
      }));
    } else if (data?.stats) {
      panels = [{ label: null, stats: data.stats }];
    } else {
      panels = [{ label: null, stats: {} }];
    }

    map.set(id, panels);
  }

  return map;
}

/**
 * Normaliza stats crudos a { [key]: { valor, rango } }.
 * Se conserva el valor numérico (además del rango) para poder mostrar
 * los "puntos" con el botón "Ver puntos".
 */
function normalizeStats(rawStats) {
  return Object.fromEntries(
    Object.entries(rawStats ?? {})
      .map(([key, rawValue]) => {
        const rango = toRankLetter(rawValue);
        if (rango == null) return null;

        let valor = null;
        if (typeof rawValue === "object" && rawValue !== null) {
          valor = typeof rawValue.valor === "number" ? rawValue.valor : null;
        } else if (typeof rawValue === "number") {
          valor = rawValue;
        } else {
          const parsed = parseFloat(rawValue);
          valor = Number.isNaN(parsed) ? null : parsed;
        }

        return [key, { valor, rango }];
      })
      .filter(Boolean)
  );
}

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
      stats: normalizeStats(panel.stats),
      poder: Math.round(getPuntuacionTotal(panel.stats ?? {})),
    }));
  });
}