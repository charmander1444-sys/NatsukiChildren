// familyTreeSearch.js — buscador por nombre para el árbol familiar
// Consume el ctx de familyTreeCore.js y un mapa de MODES (nombre -> setModeX)
// para poder cambiar de modo automáticamente cuando el nodo buscado está
// oculto en el modo actual (p. ej. buscar una madre estando en "Chicos").
import { focusNodeById } from "./familyTreeCore.js";

const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Decide a qué modo hay que saltar para que el nodo buscado sea visible.
// libre/jerarquico/circular muestran todos los nodos; chicos/chicas/todos
// ocultan (fx=-9999) todo lo que no sea del tipo activo.
function pickModeForNode(node, currentMode) {
  if (["libre", "jerarquico", "circular"].includes(currentMode)) return currentMode;
  if (currentMode === "chicos" && node.tipo === "hijo") return currentMode;
  if (currentMode === "chicas" && node.tipo === "hija") return currentMode;
  if (currentMode === "todos" && ["hijo", "hija", "sin_genero"].includes(node.tipo)) return currentMode;

  if (["hijo", "hija", "sin_genero"].includes(node.tipo)) return "todos";
  return "libre"; // raiz, madre, conexion
}

/**
 * Conecta #node-search / #search-results al árbol.
 * @param {object} ctx - contexto devuelto por createFamilyTreeContext()
 * @param {object} MODES - mapa { libre: setModeLibre, chicos: setModeChicos, ... }
 */
export function initSearch(ctx, MODES) {
  const input = document.getElementById("node-search");
  const resultsBox = document.getElementById("search-results");
  if (!input || !resultsBox) return;

  const closeResults = () => {
    resultsBox.classList.add("hidden");
    resultsBox.innerHTML = "";
  };

  function selectNode(node) {
    const currentMode = ctx.state.currentMode;
    const nextMode = pickModeForNode(node, currentMode);

    if (nextMode !== currentMode) {
      MODES[nextMode](ctx);
      // Espera a que termine la transición de finalizeMode/fitView antes de centrar
      setTimeout(() => focusNodeById(ctx, node.id, { openDetail: true }), 600);
    } else {
      focusNodeById(ctx, node.id, { openDetail: true });
    }
  }

  const renderResults = (matches) => {
    resultsBox.innerHTML = "";
    if (!matches.length) return closeResults();

    matches.slice(0, 8).forEach((n) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = n.nombre;
      item.className =
        "block w-full text-left px-3 py-2 text-sm text-rz-text/85 hover:bg-rz-accent/15 hover:text-white transition-colors";
      item.addEventListener("click", () => {
        input.value = n.nombre;
        closeResults();
        selectNode(n);
      });
      resultsBox.appendChild(item);
    });
    resultsBox.classList.remove("hidden");
  };

  input.addEventListener("input", () => {
    const q = normalize(input.value.trim());
    if (!q) return closeResults();
    renderResults(ctx.nodes.filter((n) => normalize(n.nombre).includes(q)));
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = normalize(input.value.trim());
      if (!q) return;
      const match = ctx.nodes.find((n) => normalize(n.nombre).includes(q));
      if (match) { input.value = match.nombre; closeResults(); selectNode(match); }
    } else if (e.key === "Escape") {
      closeResults();
      input.blur();
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target !== input && !resultsBox.contains(e.target)) closeResults();
  });
}