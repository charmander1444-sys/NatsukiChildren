// statsConfig.js
// Fuente única de verdad para ranks, labels y colores.
// Usado por DetailStats, RadarChart y Ranking.

/**
 * Índice numérico del rank (0 = F, 9 = EX). -1 si no existe/no aplica.
 * @param {string} [rank]
 * @returns {number}
 */
import { getRango } from "../../../data/lib/stats";  // ajustá la ruta según ubicación real

export const RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SS+", "EX"];

export const STAT_LABELS = {
  fuerza: "Fuerza",
  resistencia: "Resistencia",
  velocidad: "Velocidad",
  inteligencia: "Inteligencia",
  habilidades_combate: "Combate",
  carisma: "Carisma",
  portal: "Puerta",
  afinidad_espiritual: "Afinidad",
  potencial: "Potencial",
  suerte: "Suerte",
};

export const RANK_COLORS = {
  F: "#52525b",
  E: "#71717a",
  D: "#8b8398",
  C: "#8b93b0",
  B: "#60a5fa",
  A: "#818cf8",
  S: "#b48cff",
  SS: "#e879f9",
  "SS+": "#f472b6",
  EX: "#facc15",
};

export function toRankLetter(rawValue) {
  if (rawValue == null) return null;

  if (typeof rawValue === "object") {
    if (rawValue.rango != null) {
      const upper = String(rawValue.rango).toUpperCase();
      if (RANKS.includes(upper)) return upper;
    }
    if (typeof rawValue.valor === "number") {
      return getRango(rawValue.valor);
    }
    return null;
  }

  if (typeof rawValue === "number") {
    return getRango(rawValue);
  }

  const upper = String(rawValue).toUpperCase();
  if (RANKS.includes(upper)) return upper;

  const parsed = parseFloat(rawValue);
  return Number.isNaN(parsed) ? null : getRango(parsed);
}

/**
 * Índice numérico del rank (0 = F, 9 = EX). -1 si no existe/no aplica.
 * Ahora normaliza internamente, así acepta rank crudo O ya-convertido.
 */
export function rankIndex(rank) {
  const letra = toRankLetter(rank);
  return letra ? RANKS.indexOf(letra) : -1;
}