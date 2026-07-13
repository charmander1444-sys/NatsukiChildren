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
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const rendered = [];
  const seenPadreMadre = new Set();
  nodes.filter((n) => ["hija", "hijo", "sin_genero"].includes(n.tipo)).forEach((child) => {
    const padreRel = findLink("padre", child.id);
    const madreRel = links.find((l) => isMotherLink(l.tipo) && getId(l.target) === child.id);
    const madreEsRaiz = madreRel && nodeById.get(getId(madreRel.source))?.tipo === "raiz";

    if (padreRel && madreRel && madreEsRaiz) {
      // La "madre" es en realidad una raíz que ejerce de madre (ej. Natsumi):
      // mostramos la cadena completa raíz -> padre -> hijo, en vez de saltear
      // directo de la raíz al hijo.
      rendered.push({ source: getId(padreRel.source), target: child.id, tipo: "padre" });
      const key = `${getId(madreRel.source)}->${getId(padreRel.source)}`;
      if (!seenPadreMadre.has(key)) {
        seenPadreMadre.add(key);
        rendered.push({ source: getId(madreRel.source), target: getId(padreRel.source), tipo: "raiz_padre_derivado" });
      }
    } else if (padreRel && madreRel) {
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

export function computeHierarchicalPositions(ctx) {
  const { nodes, links, findLink, layoutWidth, rowY } = ctx;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const madreOf = (id) => { const r = links.find((l) => isMotherLink(l.tipo) && getId(l.target) === id); return r ? getId(r.source) : null; };
  const padreOf = (id) => { const r = findLink("padre", id); return r ? getId(r.source) : null; };

  const hijas = nodes.filter((n) => ["hija", "hijo", "sin_genero"].includes(n.tipo))
    .sort((a, b) => (madreOf(a.id) || padreOf(a.id) || "").localeCompare(madreOf(b.id) || padreOf(b.id) || "") || a.nombre.localeCompare(b.nombre));

  const colWidth = layoutWidth / Math.max(hijas.length, 1);
  const hijaX = new Map();
  hijas.forEach((h, i) => {
    const x = MARGIN.side + colWidth * (i + 0.5);
    hijaX.set(h.id, x);
    h.fx = x; h.fy = rowY(LEVEL[h.tipo]);
  });

  // "padre" cuyo co-progenitor es en realidad una raíz (ej. Otto + Natsumi):
  // se invierte la cadena para esa rama -> de abajo hacia arriba se lee
  // raíz (se queda igual) -> padre (una fila arriba) -> hijo (dos filas arriba).
  const raizCoParentOf = new Map(); // padreId -> raizId
  const hijosDePadreDeRaiz = new Set(); // ids de hijos que cuelgan de un padre-de-raíz
  nodes.filter((n) => n.tipo === "padre").forEach((p) => {
    const hijosDelPadre = links.filter((l) => l.tipo === "padre" && getId(l.source) === p.id).map((l) => getId(l.target));
    for (const hijoId of hijosDelPadre) {
      const madreRel = links.find((l) => isMotherLink(l.tipo) && getId(l.target) === hijoId);
      if (madreRel && nodeById.get(getId(madreRel.source))?.tipo === "raiz") {
        raizCoParentOf.set(p.id, getId(madreRel.source));
        hijosDelPadre.forEach((id) => hijosDePadreDeRaiz.add(id));
        break;
      }
    }
  });

  const raizRowY = rowY(LEVEL.raiz);
  const madreRowY = rowY(LEVEL.madre);
  const rowSpacing = madreRowY - raizRowY;
  const padreRowY = raizRowY - rowSpacing;   // una fila arriba de la raíz
  const hijoInvertidoRowY = padreRowY - rowSpacing; // dos filas arriba de la raíz

  // Sube a los hijos de un padre-de-raíz a la fila invertida (arriba de todo)
  hijas.filter((h) => hijosDePadreDeRaiz.has(h.id)).forEach((h) => { h.fy = hijoInvertidoRowY; });

  const madresNormales = nodes.filter((n) => n.tipo === "madre");
  const padresDeRaiz = nodes.filter((n) => n.tipo === "padre" && raizCoParentOf.has(n.id));
  const madresYPadresDeRaiz = [...madresNormales, ...padresDeRaiz];

  madresNormales.forEach((m) => {
    const xs = links.filter((l) => isMotherLink(l.tipo) && getId(l.source) === m.id)
      .map((l) => hijaX.get(getId(l.target))).filter((x) => x !== undefined);
    m.fx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : layoutWidth / 2 + MARGIN.side;
    m.fy = rowY(LEVEL.madre);
  });
  padresDeRaiz.forEach((p) => {
    const xs = links.filter((l) => l.tipo === "padre" && getId(l.source) === p.id)
      .map((l) => hijaX.get(getId(l.target))).filter((x) => x !== undefined);
    p.fx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : layoutWidth / 2 + MARGIN.side;
    p.fy = padreRowY;
  });
  resolveOverlaps(madresNormales, { padding: 20 });
  madresNormales.forEach((m) => { m.fy = rowY(LEVEL.madre); });
  resolveOverlaps(padresDeRaiz, { padding: 20 });
  padresDeRaiz.forEach((p) => { p.fy = padreRowY; });

  const raices = nodes.filter((n) => n.tipo === "raiz" || (n.tipo === "padre" && !raizCoParentOf.has(n.id)));
  if (raices.length) {
    const madreFx = new Map(madresYPadresDeRaiz.map((m) => [m.id, m.fx]));
    const globalXs = [...hijaX.values()];
    const globalCenterX = globalXs.length ? globalXs.reduce((a, b) => a + b, 0) / globalXs.length : layoutWidth / 2 + MARGIN.side;

    const raizX = new Map();
    raices.forEach((r) => {
      const hijosDirectos = links.filter((l) => (l.tipo === "padre" || isMotherLink(l.tipo)) && getId(l.source) === r.id).map((l) => getId(l.target));
      const xs = hijosDirectos.map((id) => (madreFx.has(id) ? madreFx.get(id) : hijaX.get(id))).filter((x) => x !== undefined);
      raizX.set(r.id, xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : globalCenterX);
    });

    const minGap = (a, b) => RADIUS[a.tipo] + RADIUS[b.tipo] + 60;
    const orden = [...raices].sort((a, b) => raizX.get(a.id) - raizX.get(b.id));
    for (let i = 1; i < orden.length; i++) {
      const prevX = raizX.get(orden[i - 1].id);
      const curX = raizX.get(orden[i].id);
      const gap = minGap(orden[i - 1], orden[i]);
      if (curX - prevX < gap) raizX.set(orden[i].id, prevX + gap);
    }

    raices.forEach((r) => { r.fx = raizX.get(r.id); r.fy = rowY(LEVEL.raiz); });
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

// Posiciones radiales (modo circular): cada raíz arma su propio clúster completo
// (centro -> anillo de co-padres -> anillo de hijos). El clúster con más
// descendencia queda en el centro del lienzo; el resto se aleja lo suficiente
// para tener su propio anillo, sin pisar al principal.
export function computeCircularPositions(ctx) {
  const { nodes, links, width, height } = ctx;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const nodeRadius = Math.max(RADIUS.hija, RADIUS.hijo, RADIUS.sin_genero);
  const extraSpacing = 80;

  // Relación real padre/madre por hijo (soporta que la "madre" sea una raíz
  // jugando ese rol, como Natsumi).
  const padreOfChild = new Map();
  const madreOfChild = new Map();
  links.forEach((l) => {
    if (l.tipo === "padre") padreOfChild.set(getId(l.target), getId(l.source));
    if (isMotherLink(l.tipo)) madreOfChild.set(getId(l.target), getId(l.source));
  });

  const raices = nodes.filter((n) => n.tipo === "raiz");
  const hijosComoPadre = (raizId) => [...padreOfChild.entries()].filter(([, p]) => p === raizId).map(([hijoId]) => hijoId);
  const hijosComoMadre = (raizId) => [...madreOfChild.entries()].filter(([, m]) => m === raizId).map(([hijoId]) => hijoId);
  const totalDescendencia = (raizId) => hijosComoPadre(raizId).length + hijosComoMadre(raizId).length;

  // La raíz con más descendencia queda como clúster principal, en el centro.
  const orden = [...raices].sort((a, b) => totalDescendencia(b.id) - totalDescendencia(a.id));
  const principal = orden[0];
  const satelites = orden.slice(1);

  const centerX = width / 2, centerY = height / 2;

  // Estilo "Subaru": raíz -> varias madres (tipo "madre") -> hijos, en círculo completo.
  function buildClusterFromPadre(raiz, cx, cy) {
    const hijoIds = new Set(hijosComoPadre(raiz.id));
    const madresDelCluster = [...new Set([...hijoIds].map((id) => madreOfChild.get(id)).filter(Boolean))]
      .map((id) => nodeById.get(id)).filter((m) => m && m.tipo === "madre");

    const childrenByMadre = new Map();
    hijoIds.forEach((hijoId) => {
      const madreId = madreOfChild.get(hijoId) || "_sin_madre";
      if (!childrenByMadre.has(madreId)) childrenByMadre.set(madreId, []);
      childrenByMadre.get(madreId).push(nodeById.get(hijoId));
    });

    const groups = madresDelCluster.map((m) => ({ key: m.id, nodo: m }));
    if (childrenByMadre.has("_sin_madre")) groups.push({ key: "_sin_madre", nodo: null });

    const total = Math.max(groups.length, 1);
    const angleStep = (2 * Math.PI) / total;
    const arcSpan = angleStep * CHILD_ARC_SPAN;

    groups.forEach((g, i) => {
      const angle = i * angleStep - Math.PI / 2;
      if (g.nodo) { g.nodo.fx = cx + RING_MADRE * Math.cos(angle); g.nodo.fy = cy + RING_MADRE * Math.sin(angle); }
      const kids = (childrenByMadre.get(g.key) || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
      if (!kids.length) return;
      const childRadius = g.nodo ? RING_MADRE + RING_HIJO + extraSpacing : RING_MADRE + extraSpacing;
      layoutFan(kids, cx, cy, angle, childRadius, arcSpan, nodeRadius);
    });

    raiz.fx = cx; raiz.fy = cy;
    return madresDelCluster.length
      ? RING_MADRE + RING_HIJO + extraSpacing + nodeRadius * 2
      : RING_MADRE + extraSpacing + nodeRadius * 2;
  }

  // Estilo "Natsumi": raíz actúa de madre -> co-padres (tipo "padre") -> hijos,
  // mismo esquema de círculo completo que el clúster principal.
  function buildClusterFromMadre(raiz, cx, cy) {
    const hijoIds = new Set(hijosComoMadre(raiz.id));
    const padresDelCluster = [...new Set([...hijoIds].map((id) => padreOfChild.get(id)).filter(Boolean))]
      .map((id) => nodeById.get(id)).filter(Boolean);

    const childrenByPadre = new Map();
    hijoIds.forEach((hijoId) => {
      const padreId = padreOfChild.get(hijoId) || "_sin_padre";
      if (!childrenByPadre.has(padreId)) childrenByPadre.set(padreId, []);
      childrenByPadre.get(padreId).push(nodeById.get(hijoId));
    });

    const groups = padresDelCluster.map((p) => ({ key: p.id, nodo: p }));
    if (childrenByPadre.has("_sin_padre")) groups.push({ key: "_sin_padre", nodo: null });

    const total = Math.max(groups.length, 1);
    const angleStep = (2 * Math.PI) / total;
    const arcSpan = angleStep * CHILD_ARC_SPAN;

    groups.forEach((g, i) => {
      const angle = i * angleStep - Math.PI / 2;
      if (g.nodo) { g.nodo.fx = cx + RING_MADRE * Math.cos(angle); g.nodo.fy = cy + RING_MADRE * Math.sin(angle); }
      const kids = (childrenByPadre.get(g.key) || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
      if (!kids.length) return;
      const childRadius = g.nodo ? RING_MADRE + RING_HIJO + extraSpacing : RING_MADRE + extraSpacing;
      layoutFan(kids, cx, cy, angle, childRadius, arcSpan, nodeRadius);
    });

    raiz.fx = cx; raiz.fy = cy;
    return padresDelCluster.length
      ? RING_MADRE + RING_HIJO + extraSpacing + nodeRadius * 2
      : RING_MADRE + extraSpacing + nodeRadius * 2;
  }

  const mainOuterRadius = principal ? buildClusterFromPadre(principal, centerX, centerY) : 0;

  // Clústeres satélite: se alejan del principal lo suficiente para tener su
  // propio anillo completo, sin pisarlo ni pisarse entre ellos.
  let offsetX = centerX + mainOuterRadius;
  satelites.forEach((sat) => {
    const gap = RING_MADRE + RING_HIJO + extraSpacing + nodeRadius * 2 + 140;
    const satCenterX = offsetX + gap;
    const satCenterY = centerY;
    const satOuterRadius = buildClusterFromMadre(sat, satCenterX, satCenterY);
    offsetX = satCenterX + satOuterRadius;
  });

  // Conexiones (hermanos/medios hermanos, madre adoptiva) — un anillo más
  // afuera del nodo de origen, relativas al centro del lienzo.
  nodes.filter((n) => n.tipo === "conexion").forEach((c) => {
    const rel = links.find((l) => isSiblingLink(l.tipo) && getId(l.target) === c.id);
    const origin = rel ? nodeById.get(getId(rel.source)) : null;
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
    if (d.fx == null || d.fy == null) { d.fx = d.x; d.fy = d.y; }
  });

  // Pasada final: separa cualquier par de nodos que haya quedado superpuesto.
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