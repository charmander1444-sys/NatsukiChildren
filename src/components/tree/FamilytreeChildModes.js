// familyTreeChildModes.js — modos Chicos, Chicas y Todos del árbol familiar
import { MARGIN, resetFixedPositions, applyStaticForces, applyDynamicForces, setNodeOpacityFilter, finalizeMode } from "./familyTreeCore.js";

// Calcula un grid ordenado con los hijos/hijas del modo pedido y oculta el resto de nodos
export function computeChildrenPositions(ctx, mode) {
  const { nodes, width } = ctx;
  let targetTipos = [];

  if (mode === "chicos") targetTipos = ["hijo"];
  else if (mode === "chicas") targetTipos = ["hija"];
  else if (mode === "todos") targetTipos = ["hijo", "hija", "sin_genero"];

  const children = nodes.filter((n) => targetTipos.includes(n.tipo))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (children.length === 0) return;

  const cols = Math.ceil(Math.sqrt(children.length)) || 1;
  const colWidth = Math.max(190, (width - MARGIN.side * 2.5) / cols);
  const rowHeight = 160;

  children.forEach((child, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    child.fx = MARGIN.side + col * colWidth + colWidth / 2;
    child.fy = MARGIN.top + 100 + row * rowHeight;
  });

  // Ocultar los demás nodos (raíz, madres, conexiones) fuera del viewport
  nodes.forEach((node) => {
    if (!targetTipos.includes(node.tipo)) {
      node.fx = -9999;
      node.fy = -9999;
    }
  });
}

function setChildrenMode(ctx, mode, allowedTipos) {
  ctx.state.currentMode = mode;
  resetFixedPositions(ctx);
  computeChildrenPositions(ctx, mode);
  applyStaticForces(ctx);
  setNodeOpacityFilter(ctx, allowedTipos);
  finalizeMode(ctx, mode, [], { guides: null, fitPadding: 90 });
}

export function setModeChicos(ctx) {
  setChildrenMode(ctx, "chicos", ["hijo"]);
}

export function setModeChicas(ctx) {
  setChildrenMode(ctx, "chicas", ["hija"]);
}

export function setModeTodos(ctx) {
  setChildrenMode(ctx, "todos", [ "hijo", "hija", "sin_genero", ]);
}