function mapVertices(mapId, map) {
  map = map || {};
  if (mapId === "TRIANGLE") return triangleVertices();
  const sides = map.sides || (mapId === "PENTAGON" ? 5 : 4);
  const radius = map.radius || 600;
  const circum = radius / Math.cos(Math.PI / sides);
  const start = -Math.PI / 2 + (sides === 4 ? Math.PI / 4 : 0);
  const verts = [];
  for (let i = 0; i < sides; i++) {
    const a = start + i * Math.PI * 2 / sides;
    verts.push({ x: Math.cos(a) * circum, y: Math.sin(a) * circum });
  }
  return verts;
}

function triangleVertices() {
  const base = 1040;
  const half = base / 2;
  const side = base * 1.3;
  const height = Math.sqrt(side * side - half * half);
  const top = -height / 2;
  const bottom = height / 2;
  return [
    { x: 0, y: top },
    { x: half, y: bottom },
    { x: -half, y: bottom }
  ];
}

function mapBounds(mapId, map) {
  const verts = mapVertices(mapId, map);
  const xs = verts.map((v) => v.x);
  const ys = verts.map((v) => v.y);
  const minX = Math.min.apply(null, xs);
  const maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys);
  const maxY = Math.max.apply(null, ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function wallsFromVertices(verts) {
  return verts.map((a, i) => {
    const b = verts[(i + 1) % verts.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    let normal = normalize({ x: -edge.y, y: edge.x }, { x: 0, y: 1 });
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (dot(normal, mid) > 0) normal = { x: -normal.x, y: -normal.y };
    return { a, b, normal, c: dot(a, normal), index: i };
  });
}

function normalize(v, fallback) {
  const length = Math.sqrt(v.x * v.x + v.y * v.y);
  if (length < 0.000001) return fallback || { x: 1, y: 0 };
  return { x: v.x / length, y: v.y / length };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

module.exports = { mapVertices, mapBounds, wallsFromVertices };
