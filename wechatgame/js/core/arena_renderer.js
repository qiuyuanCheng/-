const { mapVertices } = require("./map_geometry");

function drawArena(ctx, snap, width, height, mapId, options) {
  options = options || {};
  const limits = options.visualLimits ? { projectiles: 90, hazards: 80, effects: 120 } : null;
  const projectiles = limits ? (snap.projectiles || []).slice(-limits.projectiles) : (snap.projectiles || []);
  const hazards = limits ? (snap.hazards || []).slice(-limits.hazards) : (snap.hazards || []);
  const effects = limits ? (snap.effects || []).slice(-limits.effects) : (snap.effects || []);
  ctx.clearRect(0, 0, width, height);
  drawBackdrop(ctx, width, height);
  ctx.save();
  const shake = options.shake || { x: 0, y: 0 };
  ctx.translate(shake.x || 0, shake.y || 0);
  const scale = options.scale || Math.min(width, height) / 1400;
  ctx.translate(typeof options.centerX === "number" ? options.centerX : width / 2, typeof options.centerY === "number" ? options.centerY : height / 2);
  ctx.scale(scale, scale);
  if (options.showMap !== false) drawMap(ctx, mapId);
  for (const h of hazards) drawHazard(ctx, h);
  for (const p of projectiles) drawProjectile(ctx, p);
  for (const beam of snap.beams) drawBeam(ctx, beam);
  for (const w of snap.weapons) drawWeapon(ctx, w);
  for (const b of snap.balls) drawBall(ctx, b, options.assets || {}, options.squashById && options.squashById[b.id]);
  for (const e of effects) drawEffect(ctx, e);
  ctx.restore();
}

function drawBackdrop(ctx, width, height) {
  ctx.fillStyle = "#030607";
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createRadialGradient(width * 0.5, height * 0.44, 20, width * 0.5, height * 0.44, Math.max(width, height) * 0.72);
  grad.addColorStop(0, "rgba(25, 194, 177, 0.13)");
  grad.addColorStop(0.52, "rgba(11, 24, 28, 0.25)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawMap(ctx, mapId) {
  const verts = mapVertices(mapId, { id: mapId, sides: mapId === "TRIANGLE" ? 3 : mapId === "PENTAGON" ? 5 : 4, radius: 600 });
  const bounds = boundsFor(verts);
  ctx.save();
  ctx.beginPath();
  verts.forEach((v, i) => {
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 2;
  for (let x = Math.floor(bounds.minX / 120) * 120; x <= bounds.maxX; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, bounds.minY);
    ctx.lineTo(x, bounds.maxY);
    ctx.stroke();
  }
  for (let y = Math.floor(bounds.minY / 120) * 120; y <= bounds.maxY; y += 120) {
    ctx.beginPath();
    ctx.moveTo(bounds.minX, y);
    ctx.lineTo(bounds.maxX, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "#f4f7fb";
  ctx.lineWidth = 7;
  ctx.beginPath();
  verts.forEach((v, i) => {
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#294957";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function boundsFor(verts) {
  const xs = verts.map((v) => v.x);
  const ys = verts.map((v) => v.y);
  return {
    minX: Math.min.apply(null, xs),
    maxX: Math.max.apply(null, xs),
    minY: Math.min.apply(null, ys),
    maxY: Math.max.apply(null, ys)
  };
}

function drawBall(ctx, b, assets, squash) {
  const v = b.visual || {};
  ctx.save();
  if (squash) {
    ctx.translate(b.x, b.y);
    ctx.rotate(squash.angle || 0);
    ctx.scale(squash.scaleX || 1, squash.scaleY || 1);
    ctx.rotate(-(squash.angle || 0));
    ctx.translate(-b.x, -b.y);
  }
  ctx.globalAlpha = b.alive ? 1 : 0.35;
  const bodyRadius = b.radius * (v.bodyRadiusScale || 1);
  const renderBall = bodyRadius === b.radius ? b : Object.assign({}, b, { radius: bodyRadius });
  const img = assets && assets[b.ballId];
  if (img) {
    ctx.shadowColor = v.icon === "flame" ? "rgba(0,0,0,0)" : (v.rimGlowColor || b.color);
    ctx.shadowBlur = v.icon === "flame" ? 0 : 14;
    ctx.drawImage(img, b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = teamColor(b.teamId);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();
    drawBallLabel(ctx, b);
    drawHealth(ctx, b);
    drawStatusIcons(ctx, b);
    ctx.restore();
    return;
  }
  ctx.shadowColor = v.icon === "flame" ? "rgba(0,0,0,0)" : (v.rimGlowColor || b.color);
  ctx.shadowBlur = v.icon === "flame" ? 0 : 12;
  const grad = ctx.createRadialGradient(b.x - bodyRadius * 0.35, b.y - bodyRadius * 0.45, bodyRadius * 0.12, b.x, b.y, bodyRadius * 1.05);
  grad.addColorStop(0, v.secondaryColor || "#ffffff");
  grad.addColorStop(0.38, b.color);
  grad.addColorStop(1, shade(b.color, -0.45));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(b.x, b.y, bodyRadius, 0, Math.PI * 2);
  ctx.fill();
  drawBodyDecor(ctx, renderBall, v);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = teamColor(b.teamId);
  ctx.lineWidth = 5;
  ctx.stroke();
  drawIcon(ctx, v.icon, b.x, b.y, v.icon === "flame" ? bodyRadius * 0.58 : bodyRadius, v.secondaryColor || "#fff");
  drawBallLabel(ctx, renderBall);
  drawHealth(ctx, renderBall);
  drawStatusIcons(ctx, renderBall);
  ctx.restore();
}

function drawBallLabel(ctx, b) {
  const value = Math.max(0, Math.ceil(b.hp / b.maxHp * 100));
  ctx.save();
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = 6;
  ctx.lineWidth = Math.max(4, b.radius * 0.045);
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.max(24, b.radius * 0.42)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(String(value), b.x, b.y);
  ctx.fillText(String(value), b.x, b.y);
  ctx.restore();
}

function drawHealth(ctx, b) {
  const width = Math.max(72, b.radius * 1.45);
  const height = 6;
  const x = b.x - width / 2;
  const y = b.y - b.radius - 22;
  ctx.save();
  ctx.fillStyle = "rgba(24, 9, 16, 0.72)";
  roundRect(ctx, x, y, width, height, 3);
  ctx.fill();
  ctx.fillStyle = teamColor(b.teamId);
  roundRect(ctx, x, y, width * Math.max(0, b.hp / b.maxHp), height, 3);
  ctx.fill();
  ctx.restore();
  if (b.hp / b.maxHp < 0.3) {
    ctx.strokeStyle = "rgba(255,95,125,0.78)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 9 + Math.sin((b.hp + b.x + b.y) * 0.03) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStatusIcons(ctx, b) {
  const statuses = (b.statuses || []).slice(0, 2);
  if (!statuses.length) return;
  ctx.save();
  ctx.font = `700 ${Math.max(16, b.radius * 0.22)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  statuses.forEach((s, i) => {
    const x = b.x + (i - (statuses.length - 1) / 2) * b.radius * 0.38;
    const y = b.y - b.radius - 42;
    ctx.fillStyle = s.type === "corrosion" ? "rgba(67,223,114,0.92)" : s.type === "stun" ? "rgba(255,240,92,0.94)" : s.type === "pin" ? "rgba(255,241,166,0.94)" : "rgba(143,220,255,0.92)";
    ctx.strokeStyle = "#071015";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(12, b.radius * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(s.type === "corrosion" ? String(s.stacks || 1) : s.type === "stun" ? "!" : s.type === "pin" ? "P" : "S", x, y + 1);
  });
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadBallAssets(canvas, balls, done) {
  const assets = {};
  const list = (balls || []).filter((b) => b.visual && b.visual.assetPath);
  if (!canvas || !canvas.createImage || !list.length) {
    done(assets);
    return;
  }
  let remaining = list.length;
  list.forEach((ball) => {
    const img = canvas.createImage();
    img.onload = () => {
      assets[ball.ballId] = img;
      remaining -= 1;
      if (remaining === 0) done(assets);
    };
    img.onerror = () => {
      remaining -= 1;
      if (remaining === 0) done(assets);
    };
    img.src = ball.visual.assetPath;
  });
}

function drawIcon(ctx, icon, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (icon === "spike") {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI * 2 / 8;
      ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25);
      ctx.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    }
  } else if (icon === "sword") {
    ctx.moveTo(x + r * 0.45, y - r * 0.45);
    ctx.lineTo(x - r * 0.35, y + r * 0.35);
    ctx.moveTo(x - r * 0.08, y + r * 0.08);
    ctx.lineTo(x + r * 0.2, y + r * 0.36);
  } else if (icon === "bow") {
    ctx.arc(x, y, r * 0.45, -1.2, 1.2);
    ctx.moveTo(x - r * 0.12, y - r * 0.42);
    ctx.lineTo(x - r * 0.12, y + r * 0.42);
  } else if (icon === "thread") {
    ctx.moveTo(x - r * 0.5, y - r * 0.2);
    ctx.bezierCurveTo(x - r * 0.15, y - r * 0.55, x + r * 0.15, y + r * 0.55, x + r * 0.5, y + r * 0.2);
    ctx.moveTo(x - r * 0.5, y + r * 0.22);
    ctx.bezierCurveTo(x - r * 0.15, y + r * 0.55, x + r * 0.15, y - r * 0.55, x + r * 0.5, y - r * 0.22);
  } else if (icon === "lance") {
    ctx.moveTo(x + r * 0.52, y);
    ctx.lineTo(x - r * 0.45, y);
    ctx.moveTo(x + r * 0.52, y);
    ctx.lineTo(x + r * 0.18, y - r * 0.18);
    ctx.moveTo(x + r * 0.52, y);
    ctx.lineTo(x + r * 0.18, y + r * 0.18);
  } else if (icon === "hammer") {
    ctx.rect(x - r * 0.36, y - r * 0.2, r * 0.5, r * 0.4);
    ctx.moveTo(x + r * 0.12, y + r * 0.18);
    ctx.lineTo(x + r * 0.45, y + r * 0.45);
  } else if (icon === "saw") {
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI * 2 / 8;
      ctx.moveTo(x + Math.cos(a) * r * 0.28, y + Math.sin(a) * r * 0.28);
      ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    }
  } else if (icon === "flame") {
    ctx.moveTo(x, y - r * 0.5);
    ctx.bezierCurveTo(x + r * 0.42, y - r * 0.12, x + r * 0.18, y + r * 0.45, x, y + r * 0.5);
    ctx.bezierCurveTo(x - r * 0.42, y + r * 0.14, x - r * 0.08, y - r * 0.18, x, y - r * 0.5);
  } else if (icon === "frost") {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI * 2 / 6;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    }
  } else if (icon === "arc") {
    ctx.moveTo(x - r * 0.42, y - r * 0.28);
    ctx.lineTo(x + r * 0.02, y - r * 0.05);
    ctx.lineTo(x - r * 0.08, y + r * 0.05);
    ctx.lineTo(x + r * 0.42, y + r * 0.3);
  }
  else if (icon === "shield") ctx.arc(x, y, r * 0.45, -0.2, Math.PI + 0.2);
  else if (icon === "cannon") { ctx.rect(x - r * 0.38, y - r * 0.16, r * 0.76, r * 0.32); }
  else if (icon === "mine") { ctx.arc(x, y, r * 0.38, 0, Math.PI * 2); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x + r * 0.5, y); }
  else if (icon === "drill") { ctx.moveTo(x + r * 0.5, y); ctx.lineTo(x - r * 0.35, y - r * 0.32); ctx.lineTo(x - r * 0.35, y + r * 0.32); ctx.closePath(); }
  else if (icon === "dagger") {
    ctx.moveTo(x + r * 0.5, y);
    ctx.lineTo(x, y - r * 0.32);
    ctx.lineTo(x - r * 0.5, y);
    ctx.lineTo(x, y + r * 0.32);
    ctx.closePath();
  } else if (icon === "boomerang") ctx.arc(x, y, r * 0.42, -0.95, 0.95);
  else if (icon === "laser") { ctx.moveTo(x - r * 0.45, y); ctx.lineTo(x + r * 0.45, y); }
  else if (icon === "pulse") ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
  else if (icon === "venom") {
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
    ctx.moveTo(x - r * 0.42, y + r * 0.28);
    ctx.arc(x - r * 0.42, y + r * 0.28, r * 0.08, 0, Math.PI * 2);
    ctx.moveTo(x + r * 0.38, y - r * 0.22);
    ctx.arc(x + r * 0.38, y - r * 0.22, r * 0.08, 0, Math.PI * 2);
  } else if (icon === "star") drawStar(ctx, x, y, r * 0.38, 5);
  else if (icon === "shrapnel") {
    ctx.moveTo(x - r * 0.45, y - r * 0.22);
    ctx.lineTo(x + r * 0.38, y - r * 0.02);
    ctx.lineTo(x - r * 0.1, y + r * 0.42);
    ctx.closePath();
  } else if (icon === "harpoon") {
    ctx.moveTo(x + r * 0.5, y);
    ctx.lineTo(x - r * 0.42, y);
    ctx.moveTo(x + r * 0.5, y);
    ctx.lineTo(x + r * 0.18, y - r * 0.22);
    ctx.moveTo(x + r * 0.5, y);
    ctx.lineTo(x + r * 0.18, y + r * 0.22);
    ctx.moveTo(x - r * 0.1, y);
    ctx.arc(x - r * 0.1, y, r * 0.18, 0, Math.PI * 2);
  } else if (icon === "prism") {
    ctx.moveTo(x, y - r * 0.48);
    ctx.lineTo(x + r * 0.42, y + r * 0.28);
    ctx.lineTo(x - r * 0.42, y + r * 0.28);
    ctx.closePath();
  }
  else if (icon === "anchor") { ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x + r * 0.5, y); ctx.moveTo(x - r * 0.3, y - r * 0.25); ctx.lineTo(x - r * 0.52, y); ctx.lineTo(x - r * 0.3, y + r * 0.25); ctx.moveTo(x + r * 0.3, y - r * 0.25); ctx.lineTo(x + r * 0.52, y); ctx.lineTo(x + r * 0.3, y + r * 0.25); }
  else { ctx.moveTo(x - r * 0.35, y); ctx.lineTo(x + r * 0.35, y); ctx.moveTo(x, y - r * 0.35); ctx.lineTo(x, y + r * 0.35); }
  ctx.stroke();
}

function drawBodyDecor(ctx, b, v) {
  const x = b.x, y = b.y, r = b.radius, icon = v.icon;
  ctx.save();
  ctx.strokeStyle = v.secondaryColor || "#fff";
  ctx.fillStyle = v.secondaryColor || "#fff";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.9;
  if (icon === "spike") {
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a - 0.08) * r * 0.92, y + Math.sin(a - 0.08) * r * 0.92);
      ctx.lineTo(x + Math.cos(a) * r * 1.22, y + Math.sin(a) * r * 1.22);
      ctx.lineTo(x + Math.cos(a + 0.08) * r * 0.92, y + Math.sin(a + 0.08) * r * 0.92);
      ctx.closePath();
      ctx.fill();
    }
  } else if (icon === "saw") {
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI * 2 / 18;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98);
      ctx.lineTo(x + Math.cos(a + 0.08) * r * 1.2, y + Math.sin(a + 0.08) * r * 1.2);
      ctx.stroke();
    }
  } else if (icon === "frost") {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI * 2 / 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
      ctx.stroke();
    }
  } else if (icon === "thread" || icon === "venom") {
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === "shrapnel") {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y - r * 0.2);
    ctx.lineTo(x - r * 0.1, y + r * 0.35);
    ctx.lineTo(x + r * 0.35, y - r * 0.35);
    ctx.stroke();
  } else if (icon === "prism") {
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.55);
    ctx.lineTo(x + r * 0.48, y + r * 0.3);
    ctx.lineTo(x - r * 0.48, y + r * 0.3);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function shade(hex, amount) {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = clampColor(((c >> 16) & 255) + Math.round(255 * amount));
  const g = clampColor(((c >> 8) & 255) + Math.round(255 * amount));
  const b = clampColor((c & 255) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

function clampColor(v) {
  return Math.max(0, Math.min(255, v));
}

function drawWeapon(ctx, w) {
  ctx.save();
  ctx.translate(w.pos.x, w.pos.y);
  ctx.rotate(w.angle || 0);
  ctx.strokeStyle = w.color;
  ctx.fillStyle = w.color;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = w.color;
  ctx.shadowBlur = 18;
  if (w.weaponType === "ring") {
    ctx.strokeStyle = "#bde8ff";
    ctx.lineWidth = Math.max(10, w.radius * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, w.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = w.color;
    ctx.lineWidth = Math.max(4, w.radius * 0.035);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI * 2 / 24;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.035) * (w.radius - 4), Math.sin(a - 0.035) * (w.radius - 4));
      ctx.lineTo(Math.cos(a) * (w.radius + 18), Math.sin(a) * (w.radius + 18));
      ctx.lineTo(Math.cos(a + 0.035) * (w.radius - 4), Math.sin(a + 0.035) * (w.radius - 4));
      ctx.stroke();
    }
  } else if (w.weaponType === "rotatingShield") {
    ctx.strokeStyle = "#e8fbff";
    ctx.fillStyle = "rgba(99,215,255,0.28)";
    ctx.lineWidth = Math.max(8, (w.width || 16) * 0.55);
    const l = w.length || w.radius || 80;
    ctx.beginPath();
    ctx.moveTo(-l * 0.52, -l * 0.42);
    ctx.quadraticCurveTo(l * 0.38, -l * 0.5, l * 0.58, 0);
    ctx.quadraticCurveTo(l * 0.38, l * 0.5, -l * 0.52, l * 0.42);
    ctx.quadraticCurveTo(-l * 0.28, 0, -l * 0.52, -l * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#63d7ff";
    ctx.lineWidth *= 0.45;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-l * 0.28, i * l * 0.18);
      ctx.quadraticCurveTo(l * 0.18, i * l * 0.25, l * 0.42, 0);
      ctx.stroke();
    }
  } else if (w.weaponType === "fixedPart" || w.weaponType === "dualFixed") {
    if (w.visual === "drill") {
      const metal = ctx.createLinearGradient(-w.length * 0.35, -w.width, w.length * 0.52, w.width);
      metal.addColorStop(0, "#1d6f75");
      metal.addColorStop(0.35, "#fff1a6");
      metal.addColorStop(0.62, "#34b9b4");
      metal.addColorStop(1, "#08363a");
      ctx.fillStyle = metal;
      ctx.strokeStyle = "#fff1a6";
      ctx.lineWidth = Math.max(5, w.width * 0.16);
      ctx.beginPath();
      ctx.moveTo(w.length * 0.52, 0);
      ctx.lineTo(-w.length * 0.35, -w.width);
      ctx.lineTo(-w.length * 0.35, w.width);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = Math.max(3, w.width * 0.18);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-w.length * 0.28, i * w.width * 0.18);
        ctx.lineTo(w.length * 0.36, -i * w.width * 0.13);
        ctx.stroke();
      }
    } else if (w.visual === "lance") {
      ctx.strokeStyle = "#5a4313";
      ctx.lineWidth = Math.max(10, w.width * 1.05);
      ctx.beginPath();
      ctx.moveTo(-w.length * 0.5, 0);
      ctx.lineTo(w.length * 0.36, 0);
      ctx.stroke();
      ctx.strokeStyle = "#fff7b8";
      ctx.lineWidth *= 0.42;
      ctx.stroke();
      const blade = ctx.createLinearGradient(w.length * 0.06, -w.width * 1.9, w.length * 0.56, w.width * 1.9);
      blade.addColorStop(0, "#fff7b8");
      blade.addColorStop(0.45, "#f0c64b");
      blade.addColorStop(1, "#6f5219");
      ctx.fillStyle = blade;
      ctx.strokeStyle = "#fffbe0";
      ctx.lineWidth = Math.max(4, w.width * 0.22);
      ctx.beginPath();
      ctx.moveTo(w.length * 0.56, 0);
      ctx.lineTo(w.length * 0.12, -w.width * 1.8);
      ctx.lineTo(w.length * 0.22, 0);
      ctx.lineTo(w.length * 0.12, w.width * 1.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (w.visual === "anchor") {
      ctx.strokeStyle = "#294b59";
      ctx.lineWidth = Math.max(12, w.width * 0.95);
      ctx.beginPath();
      ctx.moveTo(-w.length * 0.48, 0);
      ctx.lineTo(w.length * 0.54, 0);
      ctx.stroke();
      ctx.strokeStyle = "#e9fbff";
      ctx.lineWidth *= 0.4;
      ctx.stroke();
      const blade = ctx.createLinearGradient(-w.length * 0.1, -w.width * 2.4, w.length * 0.58, w.width * 2.4);
      blade.addColorStop(0, "#e9fbff");
      blade.addColorStop(0.52, w.color);
      blade.addColorStop(1, "#244f5f");
      ctx.fillStyle = blade;
      ctx.strokeStyle = "#f7ffff";
      ctx.lineWidth = Math.max(4, w.width * 0.2);
      ctx.beginPath();
      ctx.moveTo(w.length * 0.55, 0);
      ctx.lineTo(w.length * 0.12, -w.width * 2.4);
      ctx.lineTo(-w.length * 0.08, 0);
      ctx.lineTo(w.length * 0.12, w.width * 2.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-w.length * 0.45, -w.width);
      ctx.lineTo(w.length * 0.5, 0);
      ctx.lineTo(-w.length * 0.45, w.width);
      ctx.closePath();
      ctx.fill();
    }
  } else if (w.weaponType === "reflector") {
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = w.visual === "prism" ? "#eaffff" : w.color;
    ctx.fillStyle = w.visual === "prism" ? "rgba(220,248,255,0.18)" : "rgba(99,215,255,0.16)";
    ctx.lineWidth = Math.max(8, (w.length || 42) * 0.08);
    ctx.beginPath();
    if (w.visual === "prism") {
      const l = w.length || 42;
      ctx.moveTo(0, -l * 0.72);
      ctx.lineTo(l * 0.6, 0);
      ctx.lineTo(0, l * 0.72);
      ctx.lineTo(-l * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const l = w.length || 42;
      ctx.arc(0, 0, l * 1.18, -1.45, 1.45);
      ctx.stroke();
      ctx.lineWidth *= 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, l * 0.92, -1.25, 1.25);
      ctx.stroke();
    }
  } else if (w.weaponType === "rotatingPart") {
    ctx.strokeStyle = w.color;
    ctx.lineWidth = w.visual === "hammer" ? 7 : 4;
    const ownerDx = w.ownerX - w.pos.x;
    const ownerDy = w.ownerY - w.pos.y;
    const ca = Math.cos(-(w.angle || 0));
    const sa = Math.sin(-(w.angle || 0));
    const ownerLocalX = ownerDx * ca - ownerDy * sa;
    const ownerLocalY = ownerDx * sa + ownerDy * ca;
    ctx.beginPath();
    ctx.moveTo(ownerLocalX, ownerLocalY);
    ctx.lineTo(0, 0);
    ctx.stroke();
    if (w.visual === "sword") {
      const blade = ctx.createLinearGradient(-w.length * 0.5, -w.width * 1.4, w.length * 0.62, w.width * 1.4);
      blade.addColorStop(0, "#24679a");
      blade.addColorStop(0.34, "#f6fbff");
      blade.addColorStop(0.62, "#8ed8ff");
      blade.addColorStop(1, "#163a61");
      ctx.fillStyle = blade;
      ctx.strokeStyle = "#4fb8ff";
      ctx.lineWidth = Math.max(6, w.width * 0.42);
      ctx.beginPath();
      ctx.moveTo(w.length * 0.62, 0);
      ctx.lineTo(-w.length * 0.28, -w.width * 1.4);
      ctx.lineTo(-w.length * 0.5, 0);
      ctx.lineTo(-w.length * 0.28, w.width * 1.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1d3f5d";
      ctx.fillRect(-w.length * 0.42, -w.width * 1.7, w.length * 0.16, w.width * 3.4);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(3, w.width * 0.18);
      ctx.beginPath();
      ctx.moveTo(-w.length * 0.18, 0);
      ctx.lineTo(w.length * 0.5, 0);
      ctx.stroke();
    } else if (w.visual === "hammer") {
      const r = Math.max(w.radius || 18, w.width || 18);
      const head = ctx.createLinearGradient(-r * 0.65, -r * 0.52, r * 0.65, r * 0.52);
      head.addColorStop(0, "#2a1518");
      head.addColorStop(0.35, "#ffe0d5");
      head.addColorStop(0.65, "#a83c46");
      head.addColorStop(1, "#1b0c0f");
      ctx.fillStyle = head;
      ctx.strokeStyle = "#ffe0d5";
      ctx.lineWidth = Math.max(5, r * 0.12);
      ctx.fillRect(-r * 0.65, -r * 0.52, r * 1.3, r * 1.04);
      ctx.strokeRect(-r * 0.65, -r * 0.52, r * 1.3, r * 1.04);
    } else {
      drawStar(ctx, 0, 0, w.radius || 10, 4);
    }
  } else if (w.weaponType === "multiOrbit") {
    ctx.strokeStyle = "#f0e7ff";
    ctx.fillStyle = w.color;
    ctx.lineWidth = 4;
    drawStar(ctx, 0, 0, w.radius || 8, 5);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, w.radius || 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProjectile(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 14;
  if (["arrow", "iceNeedle", "harpoon"].includes(p.visual)) {
    const lengthScale = p.lengthScale || 1;
    const len = Math.max(34, p.radius * (p.visual === "harpoon" ? 7.5 : 6.2) * lengthScale);
    const half = Math.max(6, p.radius * 1.05);
    const isMetalArrow = p.visual === "arrow" && p.material === "metal";
    ctx.strokeStyle = p.visual === "iceNeedle" ? "#f1fbff" : p.visual === "harpoon" ? "#eff5f8" : isMetalArrow ? "#d5dde3" : "#d8fff9";
    ctx.lineWidth = Math.max(3, p.radius * 0.45);
    ctx.beginPath();
    ctx.moveTo(-len * 0.52, 0);
    ctx.lineTo(len * 0.18, 0);
    ctx.stroke();
    if (isMetalArrow) {
      const shaft = ctx.createLinearGradient(-len * 0.5, -half, len * 0.22, half);
      shaft.addColorStop(0, "#66757f");
      shaft.addColorStop(0.35, "#f2f5f7");
      shaft.addColorStop(0.7, "#9aa8b2");
      shaft.addColorStop(1, "#3d4a52");
      ctx.strokeStyle = shaft;
      ctx.lineWidth = Math.max(5, p.radius * 0.58);
      ctx.beginPath();
      ctx.moveTo(-len * 0.5, 0);
      ctx.lineTo(len * 0.2, 0);
      ctx.stroke();
    }
    if (p.super) {
      ctx.shadowBlur = 28;
      ctx.strokeStyle = "#ffc36b";
      ctx.lineWidth = Math.max(5, p.radius * 0.18);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.28, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.visual === "iceNeedle") {
      ctx.fillStyle = "#dff8ff";
    }
    ctx.beginPath();
    ctx.moveTo(len * 0.5, 0);
    ctx.lineTo(-len * 0.22, -half);
    ctx.lineTo(-len * 0.08, 0);
    ctx.lineTo(-len * 0.22, half);
    ctx.closePath();
    ctx.fill();
  } else if (["dagger", "shard"].includes(p.visual)) {
    const len = Math.max(26, p.radius * 5);
    const half = Math.max(8, p.radius * 1.45);
    ctx.beginPath();
    ctx.moveTo(len * 0.55, 0);
    ctx.lineTo(0, -half);
    ctx.lineTo(-len * 0.55, 0);
    ctx.lineTo(0, half);
    ctx.closePath();
    ctx.fill();
  } else if (p.visual === "boomerang") {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(8, p.radius * 0.75);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(18, p.radius * 2.4), -0.95, 0.95);
    ctx.stroke();
  } else if (p.visual === "cannonball") {
    const r = Math.max(p.radius, 10);
    const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#ffc36b");
    grad.addColorStop(0.55, p.color);
    grad.addColorStop(1, "#182348");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEffect(ctx, e) {
  const t = Math.max(0, e.life / e.maxLife);
  ctx.save();
  ctx.globalAlpha = t;
  ctx.strokeStyle = e.color;
  ctx.fillStyle = e.color;
  ctx.lineWidth = 4;
  const r = e.radius * (1.4 - t);
  if (e.kind === "impact") {
    const vx = e.vx || 1;
    const vy = e.vy || 0;
    const a = Math.atan2(vy, vx);
    ctx.translate(e.x, e.y);
    ctx.rotate(a);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(4, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.lineTo(r * 1.2, 0);
    ctx.stroke();
    ctx.strokeStyle = e.color;
    ctx.lineWidth *= 0.55;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, i * r * 0.28);
      ctx.lineTo(r * (0.55 + Math.abs(i) * 0.18), i * r * 0.52);
      ctx.stroke();
    }
  } else if (e.kind === "damageNumber") {
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 8;
    ctx.font = `800 ${Math.max(18, e.radius || 22)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.82)";
    ctx.fillStyle = e.color || "#ffffff";
    ctx.strokeText(`-${e.amount || 0}`, e.x, e.y);
    ctx.fillText(`-${e.amount || 0}`, e.x, e.y);
  } else if (e.kind === "shock") {
    ctx.shadowColor = "#fff05c";
    ctx.shadowBlur = 22;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 + t * 0.8;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * r * 0.35, e.y + Math.sin(a) * r * 0.35);
      ctx.lineTo(e.x + Math.cos(a + 0.22) * r * 0.78, e.y + Math.sin(a + 0.22) * r * 0.78);
      ctx.lineTo(e.x + Math.cos(a - 0.18) * r * 1.05, e.y + Math.sin(a - 0.18) * r * 1.05);
      ctx.stroke();
    }
  } else if (e.kind === "frost") {
    ctx.strokeStyle = "#dff8ff";
    ctx.shadowColor = "#8fdcff";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(a) * r * 1.15, e.y + Math.sin(a) * r * 1.15);
      ctx.stroke();
    }
  } else if (e.kind === "arc") {
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "#fff05c";
    ctx.shadowBlur = 28;
    ctx.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5 + t;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * r * 0.25, e.y + Math.sin(a) * r * 0.25);
      ctx.lineTo(e.x + Math.cos(a + 0.35) * r * 0.72, e.y + Math.sin(a + 0.35) * r * 0.72);
      ctx.lineTo(e.x + Math.cos(a - 0.12) * r * 1.18, e.y + Math.sin(a - 0.12) * r * 1.18);
      ctx.stroke();
    }
  } else if (e.kind === "prism") {
    ctx.strokeStyle = "#eaffff";
    ctx.shadowColor = "#d7b8ff";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.x - r, e.y + r * 0.25);
    ctx.lineTo(e.x - r * 0.2, e.y - r * 0.85);
    ctx.lineTo(e.x + r, e.y + r * 0.12);
    ctx.stroke();
    ctx.strokeStyle = "#d7b8ff";
    ctx.beginPath();
    ctx.moveTo(e.x - r * 0.55, e.y - r * 0.25);
    ctx.lineTo(e.x + r * 0.58, e.y + r * 0.58);
    ctx.stroke();
  } else if (e.kind === "venom") {
    ctx.fillStyle = "rgba(103,255,92,0.22)";
    ctx.strokeStyle = "#67ff5c";
    ctx.shadowColor = "#67ff5c";
    ctx.shadowBlur = 18;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(i * 1.7) * r * 0.35, e.y + Math.sin(i * 1.7) * r * 0.25, r * (0.18 + i * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (e.kind === "anchor") {
    ctx.strokeStyle = "#e9fbff";
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 22;
    ctx.lineWidth = Math.max(5, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(e.x - r * 1.2, e.y - r * 0.45);
    ctx.lineTo(e.x + r * 1.15, e.y + r * 0.35);
    ctx.moveTo(e.x - r * 1.1, e.y + r * 0.38);
    ctx.lineTo(e.x + r * 0.95, e.y - r * 0.5);
    ctx.stroke();
  } else if (["sword", "lance", "drill"].includes(e.kind)) {
    ctx.beginPath();
    ctx.moveTo(e.x - r, e.y - r * 0.35);
    ctx.lineTo(e.x + r, e.y + r * 0.35);
    ctx.stroke();
  } else if (["cannon", "mine", "pulse"].includes(e.kind)) {
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 22;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.kind === "star") {
    drawStar(ctx, e.x, e.y, r, 5);
  } else {
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHazard(ctx, h) {
  ctx.save();
  ctx.globalAlpha = h.alpha;
  ctx.strokeStyle = h.color;
  ctx.fillStyle = h.color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = h.color;
  ctx.shadowBlur = 14;
  if (h.visual === "flameTrail") {
    ctx.globalAlpha = 0.58;
    ctx.shadowColor = "#ff6b25";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#ff6b25";
    ctx.lineWidth = Math.max(4, h.radius * 0.026);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#ffe0aa";
    ctx.lineWidth = Math.max(3, h.radius * 0.016);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ff9a4a";
    ctx.lineWidth = Math.max(2, h.radius * 0.01);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (h.kind === "line") {
    if (h.visual === "flameTrail") {
      ctx.strokeStyle = "#ff6b25";
      ctx.lineWidth = Math.max(16, h.radius * 5);
      ctx.beginPath();
      ctx.moveTo(h.x1, h.y1);
      ctx.lineTo(h.x2, h.y2);
      ctx.stroke();
      ctx.strokeStyle = "#ffe0aa";
      ctx.lineWidth *= 0.38;
    } else if (h.visual === "harpoonLine") {
      ctx.strokeStyle = "#eff5f8";
      ctx.lineWidth = Math.max(6, h.radius * 2.2);
    } else {
      ctx.strokeStyle = "#e2ffbf";
      ctx.lineWidth = Math.max(10, h.radius * 3.2);
    }
    ctx.beginPath();
    ctx.moveTo(h.x1, h.y1);
    ctx.lineTo(h.x2, h.y2);
    ctx.stroke();
  } else if (h.kind === "spike") {
    const nx = typeof h.nx === "number" ? h.nx : Math.sin(h.angle || 0);
    const ny = typeof h.ny === "number" ? h.ny : -Math.cos(h.angle || 0);
    const base = typeof h.baseX === "number" ? { x: h.baseX, y: h.baseY } : { x: h.x - nx * h.radius, y: h.y - ny * h.radius };
    const fullTip = typeof h.tipX === "number" ? { x: h.tipX, y: h.tipY } : { x: h.x + nx * h.radius * 1.8, y: h.y + ny * h.radius * 1.8 };
    const arm = h.armed === false ? Math.max(0.12, h.armProgress || 0.12) : 1;
    const tip = { x: base.x + (fullTip.x - base.x) * arm, y: base.y + (fullTip.y - base.y) * arm };
    const tangent = { x: -ny, y: nx };
    const half = Math.max(16, h.radius * 0.9);
    const baseA = { x: base.x + tangent.x * half, y: base.y + tangent.y * half };
    const baseB = { x: base.x - tangent.x * half, y: base.y - tangent.y * half };
    ctx.fillStyle = h.armed === false ? "rgba(94,136,106,0.74)" : "#b8ffd0";
    ctx.strokeStyle = "#3f6f55";
    ctx.lineWidth = Math.max(4, h.radius * 0.16);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(baseA.x, baseA.y);
    ctx.lineTo(baseB.x, baseB.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#eaffea";
    ctx.lineWidth = Math.max(3, h.radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(tip.x - nx * h.radius * 0.28, tip.y - ny * h.radius * 0.28);
    ctx.lineTo(base.x + tangent.x * half * 0.22, base.y + tangent.y * half * 0.22);
    ctx.stroke();
    ctx.strokeStyle = "#1f4633";
    ctx.lineWidth = Math.max(7, h.radius * 0.22);
    ctx.beginPath();
    ctx.moveTo(baseA.x, baseA.y);
    ctx.lineTo(baseB.x, baseB.y);
    ctx.stroke();
  } else if (h.kind === "flameRing") {
    ctx.globalAlpha = 0.6;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#ff6b25";
    ctx.lineWidth = Math.max(4, h.radius * 0.026);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#ffe0aa";
    ctx.lineWidth = Math.max(3, h.radius * 0.016);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ff9a4a";
    ctx.lineWidth = Math.max(2, h.radius * 0.01);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 0.86, 0, Math.PI * 2);
    ctx.stroke();
  } else if (h.kind === "fieldZone") {
    const isFlame = h.visual === "flameTrail";
    if (isFlame) {
      ctx.globalAlpha = 0.58;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#ff6b25";
      ctx.lineWidth = Math.max(4, h.radius * 0.028);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = "#ffe0aa";
      ctx.lineWidth = Math.max(3, h.radius * 0.018);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ff9a4a";
      ctx.lineWidth = Math.max(2, h.radius * 0.01);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.globalAlpha = h.alpha * 0.42;
    ctx.fillStyle = "rgba(111,124,255,0.22)";
    ctx.strokeStyle = "#f0edff";
    ctx.lineWidth = Math.max(5, h.radius * 0.035);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = h.color;
    ctx.lineWidth *= 0.72;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * (0.62 + 0.18 * h.alpha), 0, Math.PI * 2);
    ctx.stroke();
  } else if (h.kind === "prismZone") {
    ctx.globalAlpha = 0.24 * h.alpha;
    ctx.fillStyle = h.side >= 0 ? "rgba(215,184,255,0.28)" : "rgba(234,255,255,0.24)";
    const dx = h.x2 - h.x1;
    const dy = h.y2 - h.y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len * (h.side || 1);
    const ny = dx / len * (h.side || 1);
    ctx.beginPath();
    ctx.moveTo(h.x1, h.y1);
    ctx.lineTo(h.x2, h.y2);
    ctx.lineTo(h.x2 + nx * 1600, h.y2 + ny * 1600);
    ctx.lineTo(h.x1 + nx * 1600, h.y1 + ny * 1600);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.95 * h.alpha;
    ctx.strokeStyle = "#eaffff";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(h.x1, h.y1);
    ctx.lineTo(h.x2, h.y2);
    ctx.stroke();
    ctx.strokeStyle = "#d7b8ff";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (h.kind === "pulse") {
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = "#f0edff";
    ctx.lineWidth = Math.max(8, h.radius * 0.06);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth *= 0.45;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  } else if (h.kind === "mine") {
    if (h.armed === false) ctx.globalAlpha *= 0.45;
    ctx.fillStyle = "#27221a";
    ctx.strokeStyle = "#ffd536";
    ctx.lineWidth = Math.max(5, h.radius * 0.13);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI * 2 / 8;
      ctx.beginPath();
      ctx.arc(h.x + Math.cos(a) * h.radius * 0.62, h.y + Math.sin(a) * h.radius * 0.62, h.radius * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd536";
      ctx.fill();
    }
  } else if (h.kind === "dot") {
    ctx.fillStyle = "#67ff5c";
    ctx.strokeStyle = "#eaffea";
    ctx.lineWidth = Math.max(3, h.radius * 0.12);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 1.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    if (h.armed === false) ctx.globalAlpha *= 0.35;
    ctx.fill();
  }
  ctx.restore();
}

function drawBeam(ctx, beam) {
  ctx.save();
  if (beam.kind === "warning") {
    ctx.globalAlpha = 0.48;
    ctx.setLineDash([24, 16]);
    ctx.shadowColor = "#ff5f7d";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#ff5f7d";
    ctx.lineWidth = Math.max(4, beam.width || 6);
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  ctx.shadowColor = beam.color;
  ctx.shadowBlur = beam.kind === "refract" ? 30 : 22;
  ctx.strokeStyle = beam.color;
  ctx.lineWidth = beam.kind === "refract" ? 12 : 18;
  ctx.beginPath();
  ctx.moveTo(beam.x1, beam.y1);
  ctx.lineTo(beam.x2, beam.y2);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(beam.x1, beam.y1);
  ctx.lineTo(beam.x2, beam.y2);
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx, x, y, r, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + i * Math.PI / points;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

function teamColor(team) {
  if (team === "A") return "#19c2b1";
  if (team === "B") return "#ff5f7d";
  return "#f3d45c";
}

module.exports = { drawArena, loadBallAssets };
