// familyTreeCore.js — setup compartido del árbol familiar (D3)
// Contiene todo lo que NO es específico de un modo: SVG, defs, simulación,
// render de nodos/links, panel de detalle, zoom/fit y helpers de "aplicar modo".
// Los archivos familyTreeFreeModes.js y familyTreeChildModes.js consumen el
// contexto (ctx) que devuelve createFamilyTreeContext().
import * as d3 from "d3";

export const COLOR = { raiz: "#b48cff", madre: "#6ee7ff", hija: "#f472b6", hijo: "#60a5fa", sin_genero: "#cbd5e1", conexion: "#8b8398", };
export const RADIUS = { raiz: 34, madre: 26, hija: 30, hijo: 30, sin_genero: 30, conexion: 20, };
export const LEVEL = { raiz: 0, madre: 1, hija: 2, hijo: 2, sin_genero: 2, conexion: 3, };
export const LEVEL_LABEL = { raiz: "Padre", madre: "Madres", hija: "Hijos e Hijas", hijo: "Hijos e Hijas", sin_genero: "Hijos e Hijas", conexion: "Otras conexiones", chicos: "Chicos", chicas: "Chicas", };
export const LEVEL_COUNT = 4;
export const MARGIN = { top: 70, bottom: 60, side: 90 };
export const RING_MADRE = 360;
export const RING_HIJO = 380;
export const CHILD_ARC_SPAN = 0.92;  // % del sector angular que ocupan los hijos
export const COL_MIN_WIDTH = 170;   // ancho mínimo por columna en modo jerárquico
export const FIXED_COLLIDE_PAD = 34; // separación extra de nodos en modos jerárquico/circular

export const getId = (x) => (typeof x === "object" && x !== null ? x.id : x);

// Estilos de línea según tipo de relación (compartidos por libre/jerárquico/circular)
const strokeForLink = (d) =>
  d.tipo === "media_hermana" || d.tipo === "madre_adoptiva" ? "#8b8398" : d.tipo === "madre" ? COLOR.madre : COLOR.raiz;
const widthForLink = (d) => (d.tipo === "padre" || d.tipo === "madre" ? 2 : 1.4);
const dashForLink = (d) =>
  d.tipo === "media_hermana" || d.tipo === "madre_adoptiva" ? "4 4" : d.tipo === "padre_madre_derivado" ? "3 5" : null;
const markerForLink = (d) => (d.tipo === "padre" || d.tipo === "madre" ? `url(#arrow-${d.tipo})` : null);
const opacityForLink = (d) => (d.tipo === "padre_madre_derivado" ? 0.4 : 0.6);

/**
 * Crea todo el setup base (SVG, defs, simulación, nodos, links, panel de detalle)
 * y devuelve un contexto (ctx) que los módulos de modo usan para leer/mutar estado.
 */
export function createFamilyTreeContext(data) {
  const container = document.getElementById("tree-svg");
  const panel = document.getElementById("detail-panel");
  const backdrop = document.getElementById("detail-backdrop");
  const content = document.getElementById("detail-content");
  const closeBtn = document.getElementById("close-panel");
  const modeButtons = document.querySelectorAll(".layout-toggle");
  const width = container.clientWidth, height = container.clientHeight;

  const nodes = data.personas.map((p) => ({ ...p, nombre: p.nombre }));
  const links = data.relaciones.map((r) => ({ source: r.origen, target: r.destino, tipo: r.tipo }));
  const findLink = (tipo, targetId) => links.find((l) => l.tipo === tipo && getId(l.target) === targetId);

  const rowY = (level) => MARGIN.top + (level / (LEVEL_COUNT - 1)) * (height - MARGIN.top - MARGIN.bottom);
const totalHijos = nodes.filter((n) => ["hija", "hijo", "sin_genero"].includes(n.tipo) ).length;
  const layoutWidth = Math.max(width - MARGIN.side * 2, COL_MIN_WIDTH * totalHijos);

  const svg = d3.select(container).attr("viewBox", [0, 0, width, height]);
  const zoomLayer = svg.append("g");
  const zoomBehavior = d3.zoom().scaleExtent([0.12, 2.2]).on("zoom", (e) => zoomLayer.attr("transform", e.transform));
  svg.call(zoomBehavior);

  // Guías de fila (jerárquico) + guías circulares (circular)
  const rowGuides = zoomLayer.append("g").attr("id", "row-guides").style("opacity", 0);
  const circleGuides = zoomLayer.append("g").attr("id", "circle-guides").style("opacity", 0);
  const guideWidth = layoutWidth + MARGIN.side * 2;
  const drawnLevels = new Set();
  Object.entries(LEVEL).forEach(([tipo, level]) => {
    if (drawnLevels.has(level)) return;
    drawnLevels.add(level);
    const y = rowY(level);
    rowGuides.append("line").attr("x1", MARGIN.side * 0.5).attr("x2", guideWidth - MARGIN.side * 0.5)
      .attr("y1", y).attr("y2", y).attr("stroke", "#b48cff").attr("stroke-opacity", 0.12).attr("stroke-width", 1);
    rowGuides.append("text").attr("x", MARGIN.side * 0.5).attr("y", y - 12)
      .attr("fill", "#f5f3ff").attr("fill-opacity", 0.35).attr("font-family", "Cinzel, serif")
      .attr("font-size", "11px").attr("letter-spacing", "0.08em").text(LEVEL_LABEL[tipo].toUpperCase());
  });
  [RING_MADRE, RING_MADRE + RING_HIJO].forEach((r) => {
    circleGuides.append("circle").attr("cx", width / 2).attr("cy", height / 2).attr("r", r)
      .attr("fill", "none").attr("stroke", "#b48cff").attr("stroke-opacity", 0.12).attr("stroke-width", 1);
  });

  // Marcadores de flecha + clip paths de avatar
  svg.append("defs").selectAll("marker").data(["padre", "madre"]).join("marker")
    .attr("id", (d) => `arrow-${d}`).attr("viewBox", "0 -5 10 10").attr("refX", 22).attr("refY", 0)
    .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
    .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", (d) => (d === "padre" ? COLOR.raiz : COLOR.madre));

  svg.append("defs").selectAll("clipPath").data(nodes).join("clipPath")
    .attr("id", (d) => `clip-${d.id}`).append("circle").attr("r", (d) => RADIUS[d.tipo]);

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id)
      .distance((d) => (d.tipo === "padre" || d.tipo === "madre" ? 130 : 190)).strength(0.7))
    .force("charge", d3.forceManyBody().strength(-420))
    .force("collide", d3.forceCollide().radius((d) => RADIUS[d.tipo] + 26))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const linksLayer = zoomLayer.append("g");
  let link = linksLayer.selectAll("line");

  function styleLink(sel) {
    sel.attr("stroke", strokeForLink).attr("stroke-width", widthForLink)
      .attr("stroke-dasharray", dashForLink).attr("stroke-opacity", opacityForLink).attr("marker-end", markerForLink);
  }
  function updateLinks(dataLinks) {
    link = linksLayer.selectAll("line")
      .data(dataLinks, (d) => `${getId(d.source)}->${getId(d.target)}-${d.tipo}`)
      .join((enter) => enter.append("line").call(styleLink), (update) => update.call(styleLink), (exit) => exit.remove());
    simulation.force("link").links(dataLinks);
  }

  // Estado mutable compartido entre módulos de modo
  const state = { currentMode: "libre" };

  const node = zoomLayer.append("g").selectAll("g").data(nodes).join("g")
    .style("cursor", "pointer")
    .call(
      d3.drag()
        .on("start", (e, d) => {
          if (state.currentMode !== "libre" && state.currentMode !== "todos") return;
          if (!e.active) simulation.alphaTarget(0.8).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (e, d) => {
          if (state.currentMode !== "libre" && state.currentMode !== "todos") return;
          d.fx = e.x;
          d.fy = e.y;
        })
        .on("end", (e, d) => {
          if (state.currentMode !== "libre" && state.currentMode !== "todos") return;
          if (!e.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    )
    .on("click", (e, d) => {
      e.stopPropagation();
      showDetail(d);
    });

  node.append("circle").attr("r", (d) => RADIUS[d.tipo]).attr("fill", (d) => COLOR[d.tipo]).attr("fill-opacity", 0.18);

  node.filter((d) => d.avatar).append("image")
    .attr("href", (d) => d.avatar).attr("x", (d) => -RADIUS[d.tipo]).attr("y", (d) => -RADIUS[d.tipo])
    .attr("width", (d) => RADIUS[d.tipo] * 2).attr("height", (d) => RADIUS[d.tipo] * 2)
    .attr("clip-path", (d) => `url(#clip-${d.id})`).attr("preserveAspectRatio", "xMidYMid slice");

  node.append("circle").attr("r", (d) => RADIUS[d.tipo]).attr("fill", "none")
    .attr("stroke", (d) => COLOR[d.tipo]).attr("stroke-width", 2)
    .style("filter", (d) => (d.tipo === "raiz" ? `drop-shadow(0 0 10px ${COLOR.raiz})` : null));

  node.append("text").text((d) => d.nombre).attr("text-anchor", "middle")
    .attr("dy", (d) => RADIUS[d.tipo] + 16).attr("fill", "#f5f3ff")
    .attr("font-family", "Cormorant Garamond, serif").attr("font-size", "13px").style("pointer-events", "none");

  simulation.on("tick", () => {
    link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  function fitView(padding = 70) {
    let relevant;
    const posX = (n) => (n.fx != null ? n.fx : n.x);
    const posY = (n) => (n.fy != null ? n.fy : n.y);

    if (state.currentMode === "chicos" || state.currentMode === "chicas") {
      const targetTipo = state.currentMode === "chicos" ? "hijo" : "hija";
      relevant = nodes.filter((n) => n.tipo === targetTipo);
    } else if (state.currentMode === "todos") {
      // en "todos" los nodos hijo/hija están libres (fx/fy null), usamos su posición real
      relevant = nodes.filter((n) => ["hijo", "hija", "sin_genero"].includes(n.tipo) );
    } else {
      relevant = nodes.filter((n) => n.fx != null && n.fy != null && n.fx > -9000);
    }

    if (!relevant.length) return;

    const xs = relevant.map(posX);
    const ys = relevant.map(posY);

    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;

    const boxWidth = Math.max(maxX - minX, 1);
    const boxHeight = Math.max(maxY - minY, 1);

    const scale = Math.max(0.12, Math.min(width / boxWidth, height / boxHeight, 1.35, 2.2));

    const tx = width / 2 - scale * (minX + boxWidth / 2);
    const ty = height / 2 - scale * (minY + boxHeight / 2);

    svg.transition().duration(450).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  const resetView = () => svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity);

  // --- Panel de detalle ---
  const CLOSED_CLASSES = ["opacity-0", "translate-y-full", "sm:translate-y-0", "sm:translate-x-4", "pointer-events-none"];
  const OPEN_CLASSES = ["opacity-100", "translate-y-0", "translate-x-0"];

  const openPanel = () => {
    panel.classList.remove(...CLOSED_CLASSES);
    panel.classList.add(...OPEN_CLASSES);
    backdrop.classList.remove("opacity-0", "pointer-events-none");
    backdrop.classList.add("opacity-100");
  };
  const closePanel = () => {
    panel.classList.remove(...OPEN_CLASSES);
    panel.classList.add(...CLOSED_CLASSES);
    backdrop.classList.add("opacity-0", "pointer-events-none");
    backdrop.classList.remove("opacity-100");
  };

  function showDetail(d) {
    const list = (arr) => (arr && arr.length
      ? `<ul class="list-disc list-inside space-y-1 text-sm text-rz-text/85">${arr.map((i) => `<li>${i}</li>`).join("")}</ul>`
      : "");
    const apariencia = d.apariencia
      ? Object.entries(d.apariencia).map(([k, v]) => `<li><span class="text-rz-accent-2 capitalize">${k}:</span> ${v}</li>`).join("")
      : "";

    content.innerHTML = `
      <h3 class="font-display text-xl text-white text-glow mb-1 pr-8">${d.nombre}</h3>
      <p class="text-sm text-rz-text/60 mb-3">${d.edad || "Personaje canon de Re:Zero"}</p>
      ${apariencia ? `<h4 class="font-display text-sm text-rz-accent-2 mt-3 mb-1">Apariencia</h4><ul class="text-sm space-y-1 text-rz-text/85">${apariencia}</ul>` : ""}
      ${d.personalidad ? `<h4 class="font-display text-sm text-rz-accent-2 mt-3 mb-1">Personalidad</h4>${list(d.personalidad)}` : ""}
      ${d.habilidades ? `<h4 class="font-display text-sm text-rz-accent-2 mt-3 mb-1">Habilidades</h4>${list(d.habilidades)}` : ""}
      ${d.equipamiento?.length ? `<h4 class="font-display text-sm text-rz-accent-2 mt-3 mb-1">Equipamiento</h4>${list(d.equipamiento)}` : ""}
      ${d.trivia ? `<h4 class="font-display text-sm text-rz-accent-2 mt-3 mb-1">Trivia</h4>${list(d.trivia)}` : ""}
    `;
    openPanel();
  }

  closeBtn.addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  container.addEventListener("click", (e) => { if (e.target === container) closePanel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  return {
    container, panel, backdrop, content, closeBtn, modeButtons,
    width, height, nodes, links, findLink, rowY, totalHijos, layoutWidth,
    svg, zoomLayer, zoomBehavior, rowGuides, circleGuides,
    simulation, linksLayer, updateLinks, node,
    fitView, resetView, showDetail, state,
  };
}

// --- Helpers reutilizables por los módulos de modo (evitan duplicar código) ---

export function resetFixedPositions(ctx) {
  ctx.nodes.forEach((d) => { d.fx = null; d.fy = null; });
}

export function applyDynamicForces(ctx, linkStrength = 0.7) {
  ctx.simulation.force("charge", d3.forceManyBody().strength(-420))
    .force("center", d3.forceCenter(ctx.width / 2, ctx.height / 2))
    .force("collide", d3.forceCollide().radius((d) => RADIUS[d.tipo] + 26))
    .force("link").strength(linkStrength);
}

export function applyStaticForces(ctx) {
  ctx.simulation.force("charge", null)
    .force("center", null)
    .force("collide", d3.forceCollide().radius((d) => RADIUS[d.tipo] + 44))
    .force("link").strength(0);
}

export function setNodeOpacityFilter(ctx, allowedTipos) {
  if (allowedTipos) {
    ctx.node.style("opacity", (d) => (allowedTipos.includes(d.tipo) ? 1 : 0));
  } else {
    ctx.node.style("opacity", 1);
  }
}

/**
 * Resuelve solapamientos entre nodos con posición fija (fx/fy), sin importar
 * a qué grupo/rama pertenezcan. Recorre pares de nodos y, si sus círculos
 * se superponen, los empuja en direcciones opuestas hasta que dejan de tocarse.
 * Es un "seguro" adicional: no depende de que la matemática angular sea perfecta.
 */
export function resolveOverlaps(nodesList, { iterations = 300, padding = 12 } = {}) {
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < nodesList.length; i++) {
      for (let j = i + 1; j < nodesList.length; j++) {
        const a = nodesList[i], b = nodesList[j];
        let dx = b.fx - a.fx;
        let dy = b.fy - a.fy;
        let dist = Math.hypot(dx, dy);
        const minDist = RADIUS[a.tipo] + RADIUS[b.tipo] + padding;

        if (dist < minDist) {
          moved = true;
          if (dist < 0.001) {
            // Mismo punto exacto: separarlos en una dirección arbitraria pero determinística
            const angle = (i * 137.5 + j) * (Math.PI / 180);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            dist = 1;
          }
          const overlap = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          a.fx -= ux * overlap;
          a.fy -= uy * overlap;
          b.fx += ux * overlap;
          b.fy += uy * overlap;
        }
      }
    }
    if (!moved) break; // convergió, no hace falta seguir iterando
  }
}

/**
 * Cierra el ciclo de un cambio de modo: guías, links, reinicio de simulación,
 * ajuste de vista (fit/reset) y estado visual de los botones.
 */
export function finalizeMode(ctx, mode, dataLinks, { guides = null, fitPadding = 70 } = {}) {
  ctx.rowGuides.transition().duration(300).style("opacity", guides === "row" ? 1 : 0);
  ctx.circleGuides.transition().duration(300).style("opacity", guides === "circle" ? 1 : 0);

  ctx.updateLinks(dataLinks);
  ctx.simulation.alpha(1).restart();

  if (mode === "libre") {
    ctx.resetView();
  } else {
    setTimeout(() => ctx.fitView(fitPadding), 120);
  }

  ctx.modeButtons.forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle("bg-rz-accent/20", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("border-rz-accent", active);
    btn.classList.toggle("text-rz-text/60", !active);
  });
}

/**
 * Centra y hace zoom sobre un nodo por su id, y dispara un pulso visual
 * para ubicarlo fácilmente. Devuelve false si el nodo está oculto
 * (fx/fy fuera del viewport, típico de los modos chicos/chicas/todos).
 */
export function focusNodeById(ctx, id, { openDetail = false, scale = 1.3 } = {}) {
  const target = ctx.nodes.find((n) => n.id === id);
  if (!target) return false;

  const posX = target.fx != null ? target.fx : target.x;
  const posY = target.fy != null ? target.fy : target.y;
  if (posX == null || posY == null || posX < -9000 || posY < -9000) return false;

  const tx = ctx.width / 2 - scale * posX;
  const ty = ctx.height / 2 - scale * posY;

  ctx.svg.transition().duration(600).ease(d3.easeCubicInOut)
    .call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

  pulseNode(ctx, id);
  if (openDetail) ctx.showDetail(target);
  return true;
}

function pulseNode(ctx, id) {
  ctx.node.each(function (d) {
    if (d.id !== id) return;
    const g = d3.select(this);
    [0, 200].forEach((delay) => {
      g.append("circle")
        .attr("r", RADIUS[d.tipo])
        .attr("fill", "none")
        .attr("stroke", COLOR[d.tipo])
        .attr("stroke-width", 3)
        .attr("opacity", 0.9)
        .transition().delay(delay).duration(900).ease(d3.easeCubicOut)
        .attr("r", RADIUS[d.tipo] + 34)
        .attr("opacity", 0)
        .remove();
    });
  });
}