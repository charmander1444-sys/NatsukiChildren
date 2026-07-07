import { toRankLetter } from "./statsConfig.js"; // ajustá ruta según ubicación real

/**
 * Convierte el objeto de kids en un array de personas.
 */
function toKidsArray(kids) {
  return kids?.personas ?? [];
}

/**
 * Convierte statsData en un Map de ID -> array de panels.
 * Si no hay panels, envuelve stats directo en un panel con label null.
 */
function toStatsMap(statsData) {
  const map = new Map();
  
  for (const [id, data] of Object.entries(statsData ?? {})) {
    let panels;
    
    if (data?.stats?.panels) {
      // Caso: panels explícitos
      panels = data.stats.panels.map((panel) => ({
        label: panel.nombre || panel.id || null,
        stats: panel.stats || {},
      }));
    } else if (data?.stats) {
      // Caso: stats directo (sin panels)
      panels = [
        {
          label: null,
          stats: data.stats,
        },
      ];
    } else {
      // Caso: sin stats
      panels = [{ label: null, stats: {} }];
    }
    
    map.set(id, panels);
  }
  
  return map;
}

function normalizeStats(rawStats) {
  return Object.fromEntries(
    Object.entries(rawStats ?? {})
      .map(([key, rawValue]) => [key, toRankLetter(rawValue)])
      .filter(([, letra]) => letra != null)
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
      stats: normalizeStats(panel.stats), // <- ya siempre letras válidas
    }));
  });
}