// statsConfig.js
// Fuente única de verdad para ranks, labels y colores.
// Usado por DetailStats, RadarChart y Ranking.

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

/**
 * Índice numérico del rank (0 = F, 9 = EX). -1 si no existe/no aplica.
 * @param {string} [rank]
 * @returns {number}
 */
export function rankIndex(rank) {
  if (!rank) return -1;
  return RANKS.indexOf(rank.toUpperCase());
}