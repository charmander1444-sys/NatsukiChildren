// familyTreeFreeModes.js — modos Libre, Jerárquico y Circular del árbol familiar
import {
  RADIUS, LEVEL, MARGIN, RING_MADRE, RING_HIJO, CHILD_ARC_SPAN, getId, isSiblingLink,
  resetFixedPositions, applyDynamicForces, applyStaticForces,
  setNodeOpacityFilter, finalizeMode, resolveOverlaps,
} from "./familyTreeCore.js";

const isMotherLink = (tipo) => tipo === "madre" || tipo === "madre_adoptiva";

// Relaciones para modo jerárquico/circular: raíz -> madre -> hijo (colapsa padre->hijo directo)
export function buildJerarquicoLinks(ctx) {
  const { nodes, links, findLink } = ctx;
  const rendered = [];
  const seenPadreMadre = new Set();
  nodes.filter((n) => ["hija", "hijo", "sin_genero"].includes(n.tipo) ).forEach((child) => {
    const padreRel = findLink("padre", child.id);
    const madreRel = links.find((l) => isMotherLink(l.tipo) && getId(l.target) === child.id);
    if (padreRel && madreRel) {
      rendered.push({ source: getId(madreRel.source), target: child.id, tipo: madreRel.tipo });
      const key = `${getId(padreRel.source)}->${getId(madreRel.source)}`;
      if (!seenPadreMadre.has(key)) {
        seenPadreMadre.add(key);
        rendered.push({ source: getId(padreRel.source), target: getId(madreRel.source), tipo: "padre_madre_derivado" });
      }
    } else if (madreRel) rendered.push({ source: getId(madreRel.source), target: child.id, tipo: madreRel.tipo });
    else if (padreRel) rendered.push({ source: getId(padreRel.source), target: child.id, tipo: "padre" });
  });
  links.forEach((l) => { if (isSiblingLink(l.tipo)) rendered.push(l); });
  return rendered;
}

// Posiciones ordenadas por columna familiar (modo jerárquico)
export function computeHierarchicalPositions(ctx) {
  const { nodes, links, findLink, layoutWidth, rowY } = ctx;
  const madreOf = (id) => { const r = links.find((l) => isMotherLink(l.tipo) && getId(l.target) === id); return r ? getId(r.source) : null; };
  const padreOf = (id) => { const r = findLink("padre", id); return r ? getId(r.source) : null; };

  const hijas = nodes.filter((n) => ["hija", "hijo", "sin_genero"].includes(n.tipo) )
    .sort((a, b) => (madreOf(a.id) || padreOf(a.id) || "").localeCompare(madreOf(b.id) || padreOf(b.id) || "") || a.nombre.localeCompare(b.nombre));

  const colWidth = layoutWidth / Math.max(hijas.length, 1);
  const hijaX = new Map();
  hijas.forEach((h, i) => {
    const x = MARGIN.side + colWidth * (i + 0.5);
    hijaX.set(h.id, x);
    h.fx = x; h.fy = rowY(LEVEL[h.tipo]);
  });

  nodes.filter((n) => n.tipo === "madre").forEach((m) => {
    const xs = links.filter((l) => isMotherLink(l.tipo) && getId(l.source) === m.id)
      .map((l) => hijaX.get(getId(l.target))).filter((x) => x !== undefined);
    m.fx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : layoutWidth / 2 + MARGIN.side;
    m.fy = rowY(LEVEL.madre);
  });

  const raices = nodes.filter((n) => n.tipo === "raiz");
  if (raices.length) {
    const xs = [...hijaX.values()];
    const centerX = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : layoutWidth / 2 + MARGIN.side;
    raices.forEach((r, i) => {
      const offset = raices.length === 1 ? 0 : (i - (raices.length - 1) / 2) * 220;
      r.fx = centerX + offset; r.fy = rowY(LEVEL.raiz);
    });
  }

  const usedX = {};
  nodes.filter((n) => n.tipo === "conexion").forEach((c) => {
    const rel = links.find((l) => isSiblingLink(l.tipo) && getId(l.target) === c.id);
    const originId = rel ? getId(rel.source) : null;
    let x = originId && hijaX.has(originId) ? hijaX.get(originId) : layoutWidth / 2 + MARGIN.side;
    const key = Math.round(x / 10);
    usedX[key] = (usedX[key] || 0) + 1;
    if (usedX[key] > 1) x += (usedX[key] - 1) * 70;
    c.fx = x; c.fy = rowY(LEVEL.conexion);
  });
}

function layoutFan(children, centerX, centerY, baseAngle, baseRadius, arcSpan, nodeRadius) {
  const n = children.length;
  if (!n) return;

  const minGapPx = nodeRadius * 2 + 26; // separación mínima entre centros de nodos vecinos
  // cuántos nodos entran en un mismo anillo sin pisarse, dado el arco disponible
  const maxPerRing = Math.max(1, Math.floor((arcSpan * baseRadius) / minGapPx) + 1);

  let idx = 0;
  let ring = 0;
  while (idx < n) {
    const remaining = n - idx;
    const countInRing = Math.min(maxPerRing, remaining);
    const radius = baseRadius + ring * (nodeRadius * 2 + 44);

    for (let j = 0; j < countInRing; j++) {
      const t = countInRing === 1 ? 0.5 : j / (countInRing - 1);
      const childAngle = baseAngle - arcSpan / 2 + t * arcSpan;
      const child = children[idx];
      child.fx = centerX + radius * Math.cos(childAngle);
      child.fy = centerY + radius * Math.sin(childAngle);
      idx++;
    }
    ring++;
  }
}

// Posiciones radiales (modo circular): raíz en el centro, madres en anillo, hijos en anillo externo por rama
export function computeCircularPositions(ctx) {
  const { nodes, links, findLink, width, height } = ctx;
  const centerX = width / 2, centerY = height / 2;
  const madreOf = (id) => { const r = findLink("madre", id); return r ? getId(r.source) : null; };

  const madres = nodes.filter((n) => n.tipo === "madre");
  const childrenByGroup = new Map();
  nodes.filter((n) => ["hija", "hijo", "sin_genero"].includes(n.tipo)).forEach((child) => {
    const key = madreOf(child.id) || "_sin_madre";
    if (!childrenByGroup.has(key)) childrenByGroup.set(key, []);
    childrenByGroup.get(key).push(child);
  });

  const groups = madres.map((m) => ({ key: m.id, madre: m }));
  if (childrenByGroup.has("_sin_madre")) groups.push({ key: "_sin_madre", madre: null });

  const total = Math.max(groups.length, 1);
  const angleStep = (2 * Math.PI) / total;
  // margen entre grupos vecinos para que sus arcos de hijos no se toquen
  const arcSpan = angleStep * CHILD_ARC_SPAN;

  groups.forEach((g, i) => {
    const angle = i * angleStep - Math.PI / 2; // empieza arriba, sentido horario
    if (g.madre) {
      g.madre.fx = centerX + RING_MADRE * Math.cos(angle);
      g.madre.fy = centerY + RING_MADRE * Math.sin(angle);
    }
    const kids = (childrenByGroup.get(g.key) || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (!kids.length) return;

    const extraSpacing = 80;
    const childRadius = g.madre
      ? RING_MADRE + RING_HIJO + extraSpacing
      : RING_MADRE + extraSpacing;

    // radio de nodo representativo (usa el más grande entre hija/hijo/sin_genero para el cálculo de espacio)
    const nodeRadius = Math.max(RADIUS.hija, RADIUS.hijo, RADIUS.sin_genero);

    layoutFan(kids, centerX, centerY, angle, childRadius, arcSpan, nodeRadius);
  });

  // Raíz(es) en el centro
  const raices = nodes.filter((n) => n.tipo === "raiz");
  raices.forEach((r, i) => {
    if (raices.length === 1) { r.fx = centerX; r.fy = centerY; return; }
    const a = (i / raices.length) * 2 * Math.PI;
    r.fx = centerX + 50 * Math.cos(a); r.fy = centerY + 50 * Math.sin(a);
  });

  // Conexiones (hermanos/medios hermanos, madre adoptiva) — un anillo más afuera del nodo de origen
  nodes.filter((n) => n.tipo === "conexion").forEach((c) => {
    const rel = links.find((l) => isSiblingLink(l.tipo) && getId(l.target) === c.id);
    const origin = rel ? nodes.find((n) => n.id === getId(rel.source)) : null;
    if (origin && origin.fx != null) {
      const originAngle = Math.atan2(origin.fy - centerY, origin.fx - centerX);
      const originRadius = Math.hypot(origin.fx - centerX, origin.fy - centerY);
      c.fx = centerX + (originRadius + 90) * Math.cos(originAngle);
      c.fy = centerY + (originRadius + 90) * Math.sin(originAngle);
    } else {
      c.fx = centerX; c.fy = centerY + RING_MADRE + RING_HIJO + 90;
    }
  });

  // Fijar cualquier nodo que haya quedado sin posición (evita saltos)
  nodes.forEach((d) => {
    if (d.fx == null || d.fy == null) {
      d.fx = d.x;
      d.fy = d.y;
    }
  });

  // Pasada final: separa cualquier par de nodos que haya quedado superpuesto,
  // sin importar si son de la misma rama o de ramas distintas (ej. hijos de
  // madres vecinas, o casos límite del cálculo angular de layoutFan).
  resolveOverlaps(nodes, { padding: 14 });
}

export function setModeLibre(ctx) {
  ctx.state.currentMode = "libre";
  resetFixedPositions(ctx);
  applyDynamicForces(ctx, 0.7);
  setNodeOpacityFilter(ctx, null);
  finalizeMode(ctx, "libre", ctx.links, { guides: null });
}

export function setModeJerarquico(ctx) {
  ctx.state.currentMode = "jerarquico";
  resetFixedPositions(ctx);
  const dataLinks = buildJerarquicoLinks(ctx);
  computeHierarchicalPositions(ctx);
  applyStaticForces(ctx);
  setNodeOpacityFilter(ctx, null);
  finalizeMode(ctx, "jerarquico", dataLinks, { guides: "row", fitPadding: 70 });
}

export function setModeCircular(ctx) {
  ctx.state.currentMode = "circular";
  resetFixedPositions(ctx);
  const dataLinks = buildJerarquicoLinks(ctx);
  computeCircularPositions(ctx);
  applyStaticForces(ctx);
  setNodeOpacityFilter(ctx, null);
  finalizeMode(ctx, "circular", dataLinks, { guides: "circle", fitPadding: 70 });
}