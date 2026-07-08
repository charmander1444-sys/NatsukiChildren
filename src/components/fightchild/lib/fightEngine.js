// fightEngine.js
// Lógica del simulador de combate. Reutiliza getRango/getPuntuacionTotal
// de la fuente única de verdad en data/lib/stats.js para que el "nivel de
// poder" sea siempre coherente con el resto del sitio (stats x peso).
import { getRango, getPuntuacionTotal } from "../../../data/lib/stats.js";

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

export const RANK_GLOW = {
  F: "none",
  E: "none",
  D: "none",
  C: "0 0 4px #8b93b055",
  B: "0 0 6px #60a5fa66",
  A: "0 0 8px #818cf877",
  S: "0 0 10px #b48cff88",
  SS: "0 0 12px #e879f999",
  "SS+": "0 0 14px #f472b6aa",
  EX: "0 0 18px #facc15cc",
};

export function normalize(str) {
  return (str ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function toRankLetter(rawValue) {
  if (rawValue == null) return null;

  if (typeof rawValue === "object") {
    if (rawValue.rango) {
      const upper = String(rawValue.rango).toUpperCase();
      if (RANKS.includes(upper)) return upper;
    }
    if (typeof rawValue.valor === "number") return getRango(rawValue.valor);
    return null;
  }

  if (typeof rawValue === "number") return getRango(rawValue);

  const upper = String(rawValue).toUpperCase();
  if (RANKS.includes(upper)) return upper;

  const parsed = parseFloat(rawValue);
  return Number.isNaN(parsed) ? null : getRango(parsed);
}

export function toRankValue(rawValue) {
  if (rawValue == null) return null;

  if (typeof rawValue === "object") {
    return typeof rawValue.valor === "number" ? rawValue.valor : null;
  }

  if (typeof rawValue === "number") return rawValue;

  const parsed = parseFloat(rawValue);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getEntries(statsObj) {
  return Object.entries(statsObj ?? {})
    .map(([key, raw]) => [key, toRankLetter(raw), toRankValue(raw)])
    .filter((entry) => !!entry[1] && RANKS.includes(entry[1]));
}

export function isMultiPanel(stats) {
  return !!stats && Array.isArray(stats.panels);
}

/** Normaliza un bloque de stats (simple o con panels) a una lista de paneles. */
export function getPanels(stats) {
  if (!stats) return [];
  if (isMultiPanel(stats)) return stats.panels;
  return [{ id: "default", nombre: "", stats }];
}

/** Nivel de poder = stats x peso, usando la misma fórmula que el resto del sitio. */
export function computePower(statsObj) {
  if (!statsObj) return 0;
  return Math.round(getPuntuacionTotal(statsObj));
}

// ---------------------------------------------------------------------
// Simulación de la pelea: al mejor de 5 rondas, con probabilidad de
// victoria por ronda proporcional al poder relativo de cada luchador.
// ---------------------------------------------------------------------
export function simulateFight(powerA, powerB) {
  const total = powerA + powerB;
  const probA = total > 0 ? powerA / total : 0.5;

  const rounds = [];
  let winsA = 0;
  let winsB = 0;
  let round = 0;

  while (winsA < 3 && winsB < 3 && round < 5) {
    round += 1;
    const roll = Math.random();
    const winner = roll < probA ? "a" : "b";
    if (winner === "a") winsA += 1;
    else winsB += 1;
    rounds.push({ round, winner });
  }

  let winner;
  if (winsA === winsB) winner = powerA >= powerB ? "a" : "b";
  else winner = winsA > winsB ? "a" : "b";

  return { winner, rounds, winsA, winsB, probA, probB: 1 - probA };
}

// ---------------------------------------------------------------------
// Render helpers (DOM, sin dependencias de Astro en runtime)
// ---------------------------------------------------------------------
function renderHero(slotEl, person) {
  const heroEl = slotEl.querySelector("[data-fighter-hero]");
  const avatarImg = slotEl.querySelector("[data-fighter-avatar]");
  const avatarFallback = slotEl.querySelector("[data-fighter-avatar-fallback]");
  const nameEl = slotEl.querySelector("[data-fighter-name]");
  const avatarWrap = slotEl.querySelector("[data-fighter-avatar-wrap]");
  const accent = slotEl.style.getPropertyValue("--fighter-accent") || "#b48cff";

  heroEl.classList.remove("hidden");
  heroEl.classList.add("flex");
  nameEl.textContent = person.nombre;
  avatarWrap.style.borderColor = `${accent}88`;
  avatarWrap.style.boxShadow = `0 0 20px 3px ${accent}33`;

  if (person.avatar) {
    avatarImg.src = person.avatar;
    avatarImg.alt = person.nombre;
    avatarImg.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
  } else {
    avatarImg.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
  }
}

function renderStatsBars(container, entries) {
  container.innerHTML = "";
  entries.forEach(([key, rank, value]) => {
    const idx = RANKS.indexOf(rank);
    const pct = ((idx + 1) / RANKS.length) * 100;
    const color = RANK_COLORS[rank];
    const glow = RANK_GLOW[rank];

    const row = document.createElement("div");
    row.className = "flex items-center gap-2 min-w-0 w-full";

    const label = document.createElement("span");
    label.className =
      "flex-1 min-w-0 truncate text-left text-xs lg:text-sm xl:text-base uppercase tracking-wider text-rz-text/70 font-body";
    label.textContent = STAT_LABELS[key] ?? key;

    const track = document.createElement("div");
    track.className =
      "lg:hidden shrink-0 w-10 sm:w-12 h-1.5 rounded-full bg-rz-bg/70 overflow-hidden";
    const fill = document.createElement("div");
    fill.className = "h-full rounded-full transition-all duration-500";
    fill.style.width = `${pct}%`;
    fill.style.background = color;
    fill.style.boxShadow = glow;
    track.appendChild(fill);

    const valueEl = document.createElement("span");
    valueEl.className =
      "shrink-0 whitespace-nowrap text-xs lg:text-base font-display font-semibold tabular-nums";
    valueEl.innerHTML = `<span class="text-white">${value != null ? value : "—"}</span><span class="text-white/50"> - </span><span style="color:${color}">${rank}</span>`;

    row.append(label, track, valueEl);
    container.appendChild(row);
  });
}
function renderPower(slotEl, power) {
  const wrap = slotEl.querySelector("[data-fighter-power-wrap]");
  const powerEl = slotEl.querySelector("[data-fighter-power]");
  wrap.classList.remove("hidden");
  wrap.classList.add("flex");
  powerEl.textContent = power.toLocaleString("es");
}

/** Crea y conecta el estado interactivo de un slot de luchador (A o B). */
function createFighterState(slotEl, roster, statsById) {
  const state = { person: null, panelIndex: 0, power: 0 };

  const searchInput = slotEl.querySelector("[data-fighter-search]");
  const suggestionsEl = slotEl.querySelector("[data-fighter-suggestions]");
  const selectEl = slotEl.querySelector("[data-fighter-select]");
  const statsEl = slotEl.querySelector("[data-fighter-stats]");
  const panelToggleWrap = slotEl.querySelector("[data-fighter-panel-toggle-wrap]");
  const panelToggleBtn = slotEl.querySelector("[data-fighter-panel-toggle]");

  roster.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nombre;
    selectEl.appendChild(opt);
  });

function renderActivePanel() {
    const stats = statsById[state.person.id];
    const panels = getPanels(stats);
    const panel = panels[state.panelIndex] ?? panels[0];
    const entries = getEntries(panel?.stats);

    statsEl.classList.remove("hidden");
    statsEl.classList.add("grid"); // antes: "flex"
    renderStatsBars(statsEl, entries);

    state.power = computePower(panel?.stats);
    renderPower(slotEl, state.power);

    if (panels.length > 1) {
      panelToggleWrap.classList.remove("hidden");
      panelToggleWrap.classList.add("flex");
      const next = panels[(state.panelIndex + 1) % panels.length];
      panelToggleBtn.textContent = `Ver: ${next.nombre || "otro panel"}`;
    } else {
      panelToggleWrap.classList.add("hidden");
      panelToggleWrap.classList.remove("flex");
    }

    slotEl.dispatchEvent(new CustomEvent("fighter:change", { bubbles: true }));
  }

  panelToggleBtn.addEventListener("click", () => {
    const stats = statsById[state.person.id];
    const panels = getPanels(stats);
    state.panelIndex = (state.panelIndex + 1) % panels.length;
    renderActivePanel();
  });

  function selectPerson(person) {
    state.person = person;
    state.panelIndex = 0;
    renderHero(slotEl, person);
    renderActivePanel();
    searchInput.value = person.nombre;
    selectEl.value = person.id;
    suggestionsEl.classList.add("hidden");
  }

  function updateSuggestions() {
    const q = normalize(searchInput.value);
    suggestionsEl.innerHTML = "";
    if (!q) {
      suggestionsEl.classList.add("hidden");
      return;
    }
    const matches = roster.filter((p) => normalize(p.nombre).includes(q)).slice(0, 8);

    if (matches.length === 0) {
      suggestionsEl.classList.add("hidden");
      return;
    }

    matches.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "w-full flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-3 text-left text-sm lg:text-base font-body text-rz-text/80 hover:bg-rz-accent/10 hover:text-white transition-colors duration-150";
      btn.textContent = p.nombre;
      btn.addEventListener("click", () => selectPerson(p));
      suggestionsEl.appendChild(btn);
    });
    suggestionsEl.classList.remove("hidden");
  }

  searchInput.addEventListener("input", updateSuggestions);
  searchInput.addEventListener("focus", updateSuggestions);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = normalize(searchInput.value);
    const exact = roster.find((p) => normalize(p.nombre) === q);
    const matches = roster.filter((p) => normalize(p.nombre).includes(q));
    const target = exact || (matches.length === 1 ? matches[0] : null);
    if (target) selectPerson(target);
  });

  document.addEventListener("click", (e) => {
    if (!slotEl.contains(e.target)) suggestionsEl.classList.add("hidden");
  });

  selectEl.addEventListener("change", () => {
    const person = roster.find((p) => p.id === selectEl.value);
    if (person) selectPerson(person);
  });

  return state;
}

/** Punto de entrada: conecta un widget <section data-fight-widget> completo. */
export function initFightWidget(root) {
  const roster = JSON.parse(root.getAttribute("data-roster") || "[]");
  const statsById = JSON.parse(root.getAttribute("data-stats") || "{}");

  const slotA = root.querySelector('[data-fighter-slot="a"]');
  const slotB = root.querySelector('[data-fighter-slot="b"]');

  const stateA = createFighterState(slotA, roster, statsById);
  const stateB = createFighterState(slotB, roster, statsById);

  const simulateBtn = root.querySelector("[data-fight-simulate]");
  const powerCompare = root.querySelector("[data-power-compare]");
  const powerBarA = root.querySelector("[data-power-bar-a]");
  const powerBarB = root.querySelector("[data-power-bar-b]");
  const resultEl = root.querySelector("[data-fight-result]");
  const winnerEl = root.querySelector("[data-fight-winner]");
  const roundsEl = root.querySelector("[data-fight-rounds]");
  const resetBtn = root.querySelector("[data-fight-reset]");

  function refreshReadiness() {
    const ready = !!stateA.person && !!stateB.person;
    simulateBtn.disabled = !ready;
    if (ready) {
      const total = stateA.power + stateB.power || 1;
      powerCompare.classList.remove("hidden");
      powerCompare.classList.add("flex");
      powerBarA.style.width = `${(stateA.power / total) * 100}%`;
      powerBarB.style.width = `${(stateB.power / total) * 100}%`;
    } else {
      powerCompare.classList.add("hidden");
    }
    resultEl.classList.add("hidden");
    resultEl.classList.remove("flex");
  }

  root.addEventListener("fighter:change", refreshReadiness);

  simulateBtn.addEventListener("click", () => {
    if (!stateA.person || !stateB.person) return;

    const result = simulateFight(stateA.power, stateB.power);
    const winnerState = result.winner === "a" ? stateA : stateB;
    const winnerSlot = result.winner === "a" ? slotA : slotB;
    const accent = winnerSlot.style.getPropertyValue("--fighter-accent") || "#facc15";

    resultEl.classList.remove("hidden");
    resultEl.classList.add("flex");
    winnerEl.textContent = `${winnerState.person.nombre} gana ${Math.max(result.winsA, result.winsB)}-${Math.min(result.winsA, result.winsB)}`;
    winnerEl.style.textShadow = `0 0 20px ${accent}aa`;

    roundsEl.innerHTML = "";
    result.rounds.forEach((r) => {
      const won = r.winner === "a" ? stateA.person : stateB.person;
      const dotColor =
        r.winner === "a"
          ? slotA.style.getPropertyValue("--fighter-accent")
          : slotB.style.getPropertyValue("--fighter-accent");

      const li = document.createElement("li");
      li.className = "text-xs lg:text-sm font-body uppercase tracking-wider px-2.5 py-1 lg:px-3.5 lg:py-1.5 rounded-full border";
      li.style.borderColor = `${dotColor}55`;
      li.style.color = dotColor;
      li.style.background = `${dotColor}14`;
      li.textContent = `Ronda ${r.round}: ${won.nombre}`;
      roundsEl.appendChild(li);
    });
  });

  resetBtn.addEventListener("click", () => {
    resultEl.classList.add("hidden");
    resultEl.classList.remove("flex");
  });
}