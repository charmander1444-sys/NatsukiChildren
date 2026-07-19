// teatroEngine.js
// Lógica del "teatro de opiniones": muestra qué opina un personaje (A)
// de otro (B), reutilizando el mismo patrón de picker + sugerencias
// que fightEngine.js, pero sin nada de poder/rondas.

export function normalize(str) {
  return (str ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Busca la opinión de `fromId` sobre `aboutId`. */
function getOpinion(opinionesById, fromId, aboutId) {
  return opinionesById?.[fromId]?.[aboutId] ?? null;
}

function renderPersonHero(slotEl, prefix, person) {
  const heroEl = slotEl.querySelector(`[data-teatro-${prefix}-hero]`);
  const avatarImg = slotEl.querySelector(`[data-teatro-${prefix}-avatar]`);
  const avatarFallback = slotEl.querySelector(`[data-teatro-${prefix}-avatar-fallback]`);
  const nameEl = slotEl.querySelector(`[data-teatro-${prefix}-name]`);

  nameEl.textContent = person.nombre;

  if (person.avatar) {
    avatarImg.src = person.avatar;
    avatarImg.alt = person.nombre;
    avatarImg.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
  } else {
    avatarImg.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
  }

  return heroEl;
}

/** Crea y conecta el estado interactivo de un slot de selector (A o B). */
function createPickerState(slotEl, roster) {
  const state = { person: null };

  const searchInput = slotEl.querySelector("[data-teatro-search]");
  const suggestionsEl = slotEl.querySelector("[data-teatro-suggestions]");
  const selectEl = slotEl.querySelector("[data-teatro-select]");

  roster.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nombre;
    selectEl.appendChild(opt);
  });

  function selectPerson(person) {
    state.person = person;
    searchInput.value = person.nombre;
    selectEl.value = person.id;
    suggestionsEl.classList.add("hidden");
    slotEl.dispatchEvent(new CustomEvent("teatro:change", { bubbles: true }));
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

/** Punto de entrada: conecta un widget <section data-teatro-widget> completo. */
export function initTeatroWidget(root) {
  const roster = JSON.parse(root.getAttribute("data-roster") || "[]");
  const opinionesById = JSON.parse(root.getAttribute("data-opiniones") || "{}");

  const slotA = root.querySelector('[data-teatro-slot="a"]');
  const slotB = root.querySelector('[data-teatro-slot="b"]');
  const stage = root.querySelector("[data-teatro-stage]");
  const textEl = root.querySelector("[data-teatro-text]");

  const stateA = createPickerState(slotA, roster);
  const stateB = createPickerState(slotB, roster);

  function refreshStage() {
  if (!stateA.person || !stateB.person) {
    stage.classList.add("hidden");
    stage.classList.remove("grid"); // ← antes "flex"
    return;
  }

  try {
    renderPersonHero(stage, "a", stateA.person);
    renderPersonHero(stage, "b", stateB.person);

    const opinion = getOpinion(opinionesById, stateA.person.id, stateB.person.id);

    textEl.textContent =
      opinion?.descripcion ??
      `${stateA.person.nombre} aún no ha compartido su opinión sobre ${stateB.person.nombre}.`;

    renderCitas(stage, opinion?.citas ?? []);
  } finally {
    stage.classList.remove("hidden");
    stage.classList.add("grid"); // ← antes "flex"
  }
}

function renderCitas(stage, citas) {
  const citasEl = stage.querySelector("[data-teatro-citas]");
  if (!citasEl) return;

  citasEl.innerHTML = "";
  if (!citas.length) {
    citasEl.classList.add("hidden");
    citasEl.classList.remove("flex");
    return;
  }

  citas.forEach((cita) => {
    const separatorIndex = cita.indexOf(":");
    const hasSpeaker = separatorIndex > -1 && separatorIndex < 40;
    const speaker = hasSpeaker ? cita.slice(0, separatorIndex).trim() : null;
    const line = hasSpeaker ? cita.slice(separatorIndex + 1).trim() : cita;

    const li = document.createElement("li");
    li.className =
      "relative rounded-lg border-l-4 border-rz-accent/60 bg-rz-bg-2/50 px-4 py-3 lg:px-5 lg:py-3.5";

    const quoteMark = document.createElement("span");
    quoteMark.className =
      "absolute -top-1 left-2 text-3xl lg:text-4xl font-display text-rz-accent/30 select-none";
    quoteMark.textContent = "“";
    li.appendChild(quoteMark);

    if (speaker) {
      const speakerEl = document.createElement("span");
      speakerEl.className =
        "block text-xs lg:text-sm font-display uppercase tracking-wider text-rz-accent-2 mb-1";
      speakerEl.textContent = speaker;
      li.appendChild(speakerEl);
    }

    const lineEl = document.createElement("span");
    lineEl.className =
      "block text-sm lg:text-base font-body italic leading-relaxed text-white/90";
    lineEl.textContent = line;
    li.appendChild(lineEl);

    citasEl.appendChild(li);
  });

  citasEl.classList.remove("hidden");
  citasEl.classList.add("flex");
}

  root.addEventListener("teatro:change", refreshStage); // ← esta era la línea que faltaba
}