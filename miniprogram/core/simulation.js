const { createRng } = require("./rng");
const { MAPS, MODES, BALL_BY_ID, MOVEMENT_TUNING } = require("./configs_v2");

const DT = 1 / 60;
const TWO_PI = Math.PI * 2;

function createDefaultMatch(modeId) {
  const mode = MODES[modeId || "ONE_VS_ONE"];
  const presets = {
    A1: { x: -240, y: 0, angle: 0, ballId: "B02_SWORD" },
    A2: { x: -280, y: 150, angle: -20, ballId: "B03_ARCHER" },
    B1: { x: 240, y: 0, angle: 180, ballId: "B07_SAW" },
    B2: { x: 280, y: -150, angle: 160, ballId: "B12_RICOCHET" },
    C1: { x: 0, y: 260, angle: 270, ballId: "B08_FLAME" }
  };
  return {
    mode: mode.id,
    map: "SQUARE",
    seed: Date.now() % 1000000000,
    slots: mode.slots.map((slotId) => {
      const p = presets[slotId];
      return { slotId, teamId: mode.teams[slotId], ballId: p.ballId, spawn: { x: p.x, y: p.y }, initialAngleDeg: p.angle };
    })
  };
}

class Simulation {
  constructor(config) {
    this.config = normalizeConfig(config);
    this.rng = createRng(this.config.seed);
    this.time = 0;
    this.tick = 0;
    this.events = [];
    this.projectiles = [];
    this.hazards = [];
    this.beams = [];
    this.hitTimes = {};
    this.result = null;
    this.walls = buildWalls(MAPS[this.config.map]);
    this.balls = this.config.slots.map((slot, index) => createBall(slot, index));
  }

  step() {
    if (this.result) return this.result;
    this.tick += 1;
    this.time += DT;
    for (const b of this.balls) {
      if (!b.alive) continue;
      updateStatuses(b, DT);
      this.updateWeaponTimers(b);
      this.applySpeedRecovery(b);
      b.prev.x = b.pos.x;
      b.prev.y = b.pos.y;
      b.pos.x += b.vel.x * DT;
      b.pos.y += b.vel.y * DT;
      b.travelSinceDrop += len(sub(b.pos, b.prev));
    }
    for (const b of this.balls) if (b.alive) this.resolveWall(b);
    this.resolveBallCollisions();
    for (const b of this.balls) if (b.alive) this.runWeapon(b);
    this.updateProjectiles();
    this.updateHazards();
    this.updateBeams();
    this.applyBodyDamage();
    this.checkVictory();
    return this.result;
  }

  runUntilDone(maxSeconds) {
    const maxTicks = Math.floor((maxSeconds || 90) / DT);
    while (!this.result && this.tick < maxTicks) this.step();
    if (!this.result) this.result = this.makeTimeoutResult();
    return this.result;
  }

  snapshot() {
    return {
      time: this.time,
      balls: this.balls.map((b) => ({ id: b.id, slotId: b.slotId, teamId: b.teamId, name: b.name, color: b.color, x: b.pos.x, y: b.pos.y, hp: b.hp, maxHp: b.maxHp, radius: b.radius, alive: b.alive })),
      projectiles: this.projectiles.map((p) => ({ x: p.pos.x, y: p.pos.y, radius: p.radius, color: p.color })),
      hazards: this.hazards.map((h) => ({ x: h.pos.x, y: h.pos.y, radius: h.radius || 5, color: h.color, armed: h.armedAt ? this.time >= h.armedAt : true })),
      beams: this.beams.map((b) => ({ x1: b.from.x, y1: b.from.y, x2: b.to.x, y2: b.to.y, color: b.color, life: b.life }))
    };
  }

  updateWeaponTimers(ball) {
    ball.weaponTimer -= DT;
    ball.reflectTimer -= DT;
  }

  applySpeedRecovery(ball) {
    const speed = len(ball.vel);
    const max = ball.maxSpeed * ball.tempMaxSpeedRatio;
    if (speed >= max * 0.5 || this.isTouchingBall(ball)) return;
    const dir = speed > 0.001 ? scale(ball.vel, 1 / speed) : ball.lastDir;
    const next = Math.min(speed + ball.recoverAccel * DT, max);
    ball.vel = scale(dir, next);
  }

  resolveWall(ball) {
    for (const wall of this.walls) {
      const d = dot(ball.pos, wall.normal) - wall.c;
      if (d < ball.radius) {
        const penetration = ball.radius - d;
        ball.pos = add(ball.pos, scale(wall.normal, penetration));
        const vn = dot(ball.vel, wall.normal);
        if (vn < 0) ball.vel = clampSpeed(sub(ball.vel, scale(wall.normal, 2 * vn)), ball.maxSpeed * ball.tempMaxSpeedRatio);
        this.onWallHit(ball, wall);
      }
    }
  }

  resolveBallCollisions() {
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i], b = this.balls[j];
        if (!a.alive || !b.alive) continue;
        const delta = sub(b.pos, a.pos);
        const dist = Math.max(len(delta), 0.001);
        const minDist = a.radius + b.radius;
        if (dist >= minDist) continue;
        const n = scale(delta, 1 / dist);
        const penetration = minDist - dist;
        const totalMass = a.mass + b.mass;
        a.pos = sub(a.pos, scale(n, penetration * (b.mass / totalMass)));
        b.pos = add(b.pos, scale(n, penetration * (a.mass / totalMass)));
        const rv = sub(a.vel, b.vel);
        const speedAlongNormal = dot(rv, n);
        if (speedAlongNormal < 0) {
          const impulse = (2 * speedAlongNormal) / totalMass;
          a.vel = sub(a.vel, scale(n, impulse * b.mass));
          b.vel = add(b.vel, scale(n, impulse * a.mass));
          a.vel = clampSpeed(a.vel, a.maxSpeed * a.tempMaxSpeedRatio);
          b.vel = clampSpeed(b.vel, b.maxSpeed * b.tempMaxSpeedRatio);
        }
      }
    }
  }

  runWeapon(ball) {
    const w = ball.weapon;
    if (w.type === "projectile" && ball.weaponTimer <= 0) this.shootProjectile(ball, w);
    if (w.type === "boomerang" && ball.weaponTimer <= 0) this.shootProjectile(ball, w, { boomerang: true });
    if (w.type === "harpoon" && ball.weaponTimer <= 0) this.shootProjectile(ball, w, { harpoon: true });
    if (w.type === "conditional" && ball.weaponTimer <= 0) this.arc(ball, w);
    if (w.type === "laser" && ball.weaponTimer <= 0) this.laser(ball, w);
    if (w.type === "pulse" && ball.weaponTimer <= 0) this.pulse(ball, w);
    if (w.type === "trail" || w.type === "dot") this.maybeDropTrail(ball, w);
    if (w.type === "mine") this.maybeDropMine(ball, w);
    if (["rotatingPart", "fixedPart", "ring", "multiOrbit", "dualFixed", "reflector"].includes(w.type)) this.checkPartHits(ball, w);
  }

  shootProjectile(ball, w, extra) {
    if (countOwned(this.projectiles, ball.id) >= w.maxCount) return;
    const target = this.nearestEnemy(ball);
    if (!target) return;
    const dir = norm(sub(target.pos, ball.pos), ball.lastDir);
    this.projectiles.push({
      id: `p${this.tick}_${this.projectiles.length}`,
      ownerId: ball.id,
      teamId: ball.teamId,
      pos: add(ball.pos, scale(dir, ball.radius + 8)),
      prev: copy(ball.pos),
      vel: scale(dir, w.projectileSpeed),
      radius: w.radius || 5,
      damage: w.damage,
      life: w.lifeTime || 3,
      wallBehavior: w.wallBehavior || "destroy",
      bounces: w.bounceCount || 0,
      color: ball.color,
      slowRatio: w.slowRatio,
      slowDuration: w.slowDuration,
      boomerang: extra && extra.boomerang,
      harpoon: extra && extra.harpoon,
      maxDistance: w.maxDistance,
      returnSpeed: w.returnSpeed,
      origin: copy(ball.pos),
      returning: false
    });
    ball.weaponTimer = w.cooldown || 1;
  }

  updateProjectiles() {
    const kept = [];
    for (const p of this.projectiles) {
      p.life -= DT;
      if (p.life <= 0) continue;
      const owner = this.balls.find((b) => b.id === p.ownerId);
      if (p.boomerang && owner) {
        const traveled = len(sub(p.pos, p.origin));
        if (!p.returning && traveled >= p.maxDistance) p.returning = true;
        if (p.returning) p.vel = scale(norm(sub(owner.pos, p.pos), { x: 1, y: 0 }), p.returnSpeed);
      }
      p.prev = copy(p.pos);
      p.pos = add(p.pos, scale(p.vel, DT));
      let removed = false;
      for (const wall of this.walls) {
        const d = dot(p.pos, wall.normal) - wall.c;
        if (d < p.radius) {
          if (p.wallBehavior === "bounce" && p.bounces > 0) {
            p.pos = add(p.pos, scale(wall.normal, p.radius - d));
            const vn = dot(p.vel, wall.normal);
            p.vel = sub(p.vel, scale(wall.normal, 2 * vn));
            p.bounces -= 1;
          } else if (p.wallBehavior === "explode") {
            this.explode(p, p.damage, 42, p.teamId, p.ownerId);
            removed = true;
          } else {
            removed = true;
          }
        }
      }
      if (removed) continue;
      for (const b of this.balls) {
        if (!b.alive || !isEnemyTeam(p.teamId, b.teamId)) continue;
        if (distPointSegment(b.pos, p.prev, p.pos) <= b.radius + p.radius) {
          this.damage(b, p.damage, p.ownerId, "projectile");
          if (p.slowRatio) applySlow(b, p.slowRatio, p.slowDuration);
          if (p.harpoon) this.addLineHazard(p.ownerId, p.teamId, p.origin, b.pos, p.damage * 0.68, 1);
          removed = true;
          break;
        }
      }
      if (!removed) kept.push(p);
    }
    this.projectiles = kept;
  }

  updateHazards() {
    const kept = [];
    for (const h of this.hazards) {
      h.life -= DT;
      if (h.life <= 0) continue;
      for (const b of this.balls) {
        if (!b.alive || !canHazardHit(h, b, this.time)) continue;
        const hit = h.kind === "line" ? distPointSegment(b.pos, h.from, h.to) <= b.radius + 4 : len(sub(b.pos, h.pos)) <= b.radius + h.radius;
        if (!hit) continue;
        if (this.canHit(h.id, b.id, h.hitInterval || 0.4)) {
          this.damage(b, h.damage, h.ownerId, h.kind);
          if (h.kind === "mine" || h.kind === "dot") h.life = 0;
        }
      }
      if (h.life > 0) kept.push(h);
    }
    this.hazards = kept;
  }

  updateBeams() {
    this.beams = this.beams.filter((b) => {
      b.life -= DT;
      return b.life > 0;
    });
  }

  applyBodyDamage() {
    for (const a of this.balls) {
      if (!a.alive || !a.bodyDamage) continue;
      for (const b of this.balls) {
        if (a === b || !b.alive || !isEnemyTeam(a.teamId, b.teamId)) continue;
        if (len(sub(a.pos, b.pos)) <= a.radius + b.radius && this.canHit(`body_${a.id}`, b.id, a.bodyHitInterval)) {
          this.damage(b, a.bodyDamage, a.id, "body");
        }
      }
    }
  }

  checkPartHits(ball, w) {
    const parts = weaponPoints(ball, w, this.time);
    for (const part of parts) {
      for (const target of this.balls) {
        if (!target.alive || !isEnemyTeam(ball.teamId, target.teamId)) continue;
        if (len(sub(part.pos, target.pos)) <= target.radius + part.radius && this.canHit(`${w.type}_${ball.id}`, target.id, w.hitInterval || 0.35)) {
          this.damage(target, w.damage, ball.id, w.type);
        }
      }
    }
    if (w.type === "reflector" && ball.reflectTimer <= 0) {
      for (const p of this.projectiles) {
        if (!isEnemyTeam(ball.teamId, p.teamId)) continue;
        if (parts.some((part) => len(sub(part.pos, p.pos)) <= part.radius + p.radius)) {
          p.ownerId = ball.id;
          p.teamId = ball.teamId;
          p.vel = scale(norm(sub(p.pos, ball.pos), ball.lastDir), len(p.vel));
          p.damage *= w.reflectDamageRatio || 0.8;
          ball.reflectTimer = w.cooldown || 0.25;
        }
      }
    }
  }

  arc(ball, w) {
    const target = this.nearestEnemy(ball);
    if (!target || len(sub(target.pos, ball.pos)) > w.range) return;
    this.damage(target, w.damage, ball.id, "arc");
    this.beams.push({ from: copy(ball.pos), to: copy(target.pos), color: ball.color, life: 0.12 });
    ball.weaponTimer = w.cooldown;
  }

  laser(ball, w) {
    const target = this.nearestEnemy(ball);
    if (!target) return;
    const dir = norm(sub(target.pos, ball.pos), ball.lastDir);
    const end = add(ball.pos, scale(dir, 900));
    this.beams.push({ from: copy(ball.pos), to: end, color: ball.color, life: w.beamDuration || 0.18 });
    for (const b of this.balls) {
      if (b.alive && isEnemyTeam(ball.teamId, b.teamId) && distPointSegment(b.pos, ball.pos, end) <= b.radius + (w.width || 6)) this.damage(b, w.damage, ball.id, "laser");
    }
    ball.weaponTimer = w.cooldown;
  }

  pulse(ball, w) {
    if (!this.balls.some((b) => b.alive && isEnemyTeam(ball.teamId, b.teamId) && len(sub(b.pos, ball.pos)) <= w.triggerRange)) return;
    for (const b of this.balls) {
      if (b.alive && isEnemyTeam(ball.teamId, b.teamId) && len(sub(b.pos, ball.pos)) <= w.pulseRadius) this.damage(b, w.damage, ball.id, "pulse");
    }
    this.hazards.push({ id: `pulse_${ball.id}_${this.tick}`, ownerId: ball.id, teamId: ball.teamId, pos: copy(ball.pos), radius: w.pulseRadius, damage: 0, life: 0.18, color: ball.color, kind: "pulse" });
    ball.weaponTimer = w.cooldown;
  }

  maybeDropTrail(ball, w) {
    if (ball.travelSinceDrop < w.spawnDistance || countOwned(this.hazards, ball.id) >= w.maxCount) return;
    const kind = w.type === "dot" ? "dot" : "line";
    const hazard = kind === "dot"
      ? { pos: copy(ball.pos), radius: 16 }
      : { from: copy(ball.prev), to: copy(ball.pos), pos: copy(ball.pos), radius: 4 };
    this.hazards.push(Object.assign(hazard, {
      id: `${kind}_${ball.id}_${this.tick}`,
      kind,
      ownerId: ball.id,
      teamId: ball.teamId,
      damage: w.damage,
      hitInterval: w.hitInterval || 0.4,
      life: w.lifeTime,
      color: ball.color,
      ownerGraceUntil: this.time + (w.ownerGrace || 0)
    }));
    ball.travelSinceDrop = 0;
  }

  maybeDropMine(ball, w) {
    if ((ball.travelSinceDrop < w.moveDistance && ball.weaponTimer > 0) || countOwned(this.hazards, ball.id) >= w.maxCount) return;
    this.hazards.push({ id: `mine_${ball.id}_${this.tick}`, kind: "mine", ownerId: ball.id, teamId: ball.teamId, pos: copy(ball.pos), radius: w.radius, damage: w.damage, hitInterval: 0.5, life: w.lifeTime, armedAt: this.time + w.armTime, color: ball.color });
    ball.travelSinceDrop = 0;
    ball.weaponTimer = w.cooldown;
  }

  onWallHit(ball, wall) {
    const w = ball.weapon;
    if (w.type === "wallDrop" && ball.weaponTimer <= 0 && countOwned(this.hazards, ball.id) < w.maxCount) {
      this.hazards.push({ id: `spike_${ball.id}_${this.tick}`, kind: "spike", ownerId: ball.id, teamId: "NEUTRAL", pos: add(ball.pos, scale(wall.normal, 12)), radius: w.radius, damage: w.damage, hitInterval: w.hitInterval, life: w.lifeTime, color: ball.color, ownerCanTrigger: w.ownerCanTrigger });
      ball.weaponTimer = w.cooldown;
    }
    if (w.type === "wallBurst" && ball.weaponTimer <= 0) {
      for (let i = 0; i < w.count && countOwned(this.projectiles, ball.id) < w.maxCount; i++) {
        const base = Math.atan2(wall.normal.y, wall.normal.x);
        const offset = ((i / Math.max(w.count - 1, 1)) - 0.5) * deg(w.spreadAngle);
        const dir = { x: Math.cos(base + offset), y: Math.sin(base + offset) };
        this.projectiles.push({ id: `shard_${ball.id}_${this.tick}_${i}`, ownerId: ball.id, teamId: ball.teamId, pos: copy(ball.pos), prev: copy(ball.pos), vel: scale(dir, w.projectileSpeed), radius: w.radius, damage: w.damage, life: w.lifeTime, wallBehavior: "destroy", bounces: 0, color: ball.color });
      }
      ball.weaponTimer = w.cooldown;
    }
  }

  addLineHazard(ownerId, teamId, from, to, damage, life) {
    this.hazards.push({ id: `harpoon_line_${ownerId}_${this.tick}`, kind: "line", ownerId, teamId, from: copy(from), to: copy(to), pos: copy(to), radius: 4, damage, hitInterval: 0.35, life, color: "#a7b0b8" });
  }

  explode(p, damage, radius, teamId, ownerId) {
    for (const b of this.balls) if (b.alive && isEnemyTeam(teamId, b.teamId) && len(sub(b.pos, p.pos)) <= b.radius + radius) this.damage(b, damage, ownerId, "explosion");
  }

  nearestEnemy(ball) {
    let best = null, bestDist = Infinity;
    for (const b of this.balls) {
      if (!b.alive || !isEnemyTeam(ball.teamId, b.teamId)) continue;
      const d = len(sub(b.pos, ball.pos));
      if (d < bestDist) { best = b; bestDist = d; }
    }
    return best;
  }

  isTouchingBall(ball) {
    return this.balls.some((b) => b !== ball && b.alive && len(sub(b.pos, ball.pos)) <= b.radius + ball.radius + 0.5);
  }

  canHit(sourceId, targetId, interval) {
    const key = `${sourceId}_${targetId}`;
    if ((this.hitTimes[key] || -999) + interval <= this.time) {
      this.hitTimes[key] = this.time;
      return true;
    }
    return false;
  }

  damage(target, amount, sourceId, sourceType) {
    if (!target.alive || amount <= 0) return;
    target.hp = Math.max(0, target.hp - amount);
    target.damageTaken += amount;
    const source = this.balls.find((b) => b.id === sourceId);
    if (source) {
      source.damageDone += amount;
      source.hits += 1;
      source.damageByType[sourceType] = (source.damageByType[sourceType] || 0) + amount;
    }
    this.events.push({ time: this.time, sourceId, targetId: target.id, amount, sourceType });
    if (target.hp <= 0) target.alive = false;
  }

  checkVictory() {
    const aliveTeams = Array.from(new Set(this.balls.filter((b) => b.alive).map((b) => b.teamId)));
    if (aliveTeams.length <= 1) this.result = this.makeResult(aliveTeams[0] || this.tiebreakTeam());
  }

  makeTimeoutResult() {
    const teamHp = {};
    for (const b of this.balls) teamHp[b.teamId] = (teamHp[b.teamId] || 0) + b.hp;
    const winnerTeam = Object.keys(teamHp).sort((a, b) => teamHp[b] - teamHp[a] || a.localeCompare(b))[0];
    return this.makeResult(winnerTeam, true);
  }

  tiebreakTeam() {
    return this.balls.slice().sort((a, b) => b.hp - a.hp || b.damageDone - a.damageDone || a.teamId.localeCompare(b.teamId))[0].teamId;
  }

  makeResult(winnerTeam, timeout) {
    return {
      winnerTeam,
      timeout: !!timeout,
      duration: Number(this.time.toFixed(2)),
      seed: this.config.seed,
      mode: this.config.mode,
      map: this.config.map,
      balls: this.balls.map((b) => ({
        slotId: b.slotId,
        teamId: b.teamId,
        ballId: b.ballId,
        name: b.name,
        hp: Math.round(b.hp),
        damageDone: Math.round(b.damageDone),
        damageTaken: Math.round(b.damageTaken),
        hits: b.hits,
        mainDamageSource: topKey(b.damageByType)
      }))
    };
  }
}

function normalizeConfig(config) {
  const base = createDefaultMatch(config && config.mode);
  const merged = Object.assign({}, base, config || {});
  merged.mode = MODES[merged.mode] ? merged.mode : "ONE_VS_ONE";
  merged.map = MAPS[merged.map] ? merged.map : "SQUARE";
  merged.seed = Number(merged.seed || base.seed);
  return merged;
}

function createBall(slot, index) {
  const cfg = BALL_BY_ID[slot.ballId] || BALL_BY_ID.B02_SWORD;
  const stats = cfg.stats;
  const angle = deg(slot.initialAngleDeg || 0);
  return {
    id: slot.slotId,
    slotId: slot.slotId,
    teamId: slot.teamId,
    ballId: cfg.id,
    name: cfg.name,
    color: cfg.color,
    pos: copy(slot.spawn || { x: 0, y: 0 }),
    prev: copy(slot.spawn || { x: 0, y: 0 }),
    vel: { x: Math.cos(angle) * stats.initialSpeed, y: Math.sin(angle) * stats.initialSpeed },
    lastDir: { x: Math.cos(angle), y: Math.sin(angle) },
    radius: stats.radius,
    mass: stats.mass,
    hp: stats.hp,
    maxHp: stats.hp,
    maxSpeed: stats.maxSpeed,
    recoverAccel: stats.recoverAccel,
    bodyDamage: stats.bodyDamage,
    bodyHitInterval: stats.bodyHitInterval,
    weapon: cfg.weapon,
    weaponTimer: index * 0.13,
    reflectTimer: 0,
    tempMaxSpeedRatio: 1,
    slowUntil: 0,
    travelSinceDrop: 999,
    alive: true,
    damageDone: 0,
    damageTaken: 0,
    hits: 0,
    damageByType: {}
  };
}

function buildWalls(map) {
  const sides = map.sides;
  const circum = map.radius / Math.cos(Math.PI / sides);
  const verts = [];
  const start = -Math.PI / 2 + (sides === 4 ? Math.PI / 4 : 0);
  for (let i = 0; i < sides; i++) verts.push({ x: Math.cos(start + i * TWO_PI / sides) * circum, y: Math.sin(start + i * TWO_PI / sides) * circum });
  const walls = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    const edge = sub(b, a);
    let n = norm({ x: -edge.y, y: edge.x }, { x: 0, y: 1 });
    if (dot(n, scale(add(a, b), 0.5)) > 0) n = scale(n, -1);
    walls.push({ a, b, normal: n, c: dot(a, n) });
  }
  return walls;
}

function weaponPoints(ball, w, time) {
  const speedDir = norm(ball.vel, ball.lastDir);
  if (len(ball.vel) > 1) ball.lastDir = speedDir;
  if (w.type === "ring") return [{ pos: copy(ball.pos), radius: w.radius }];
  if (w.type === "fixedPart") return [{ pos: add(ball.pos, scale(speedDir, w.offset)), radius: Math.max(w.width, w.length * 0.35) }];
  if (w.type === "dualFixed") return [{ pos: add(ball.pos, scale({ x: -speedDir.y, y: speedDir.x }, w.offset)), radius: w.length * 0.45 }, { pos: add(ball.pos, scale({ x: speedDir.y, y: -speedDir.x }, w.offset)), radius: w.length * 0.45 }];
  const count = w.count || 1;
  const points = [];
  const angular = deg(w.angularSpeed || 0) * time;
  for (let i = 0; i < count; i++) {
    const a = angular + i * TWO_PI / count;
    points.push({ pos: add(ball.pos, { x: Math.cos(a) * (w.orbitRadius || 40), y: Math.sin(a) * (w.orbitRadius || 40) }), radius: w.radius || Math.max(w.width || 8, w.length || 20) * 0.45 });
  }
  return points;
}

function canHazardHit(h, b, time) {
  if (h.armedAt && time < h.armedAt) return false;
  if (h.ownerId === b.id && !h.ownerCanTrigger && time < (h.ownerGraceUntil || Infinity)) return false;
  if (h.teamId === "NEUTRAL") return h.ownerCanTrigger || h.ownerId !== b.id;
  return isEnemyTeam(h.teamId, b.teamId);
}

function applySlow(ball, ratio, duration) {
  ball.tempMaxSpeedRatio = Math.min(ball.tempMaxSpeedRatio, ratio);
  ball.slowUntil = Math.max(ball.slowUntil, ball.slowUntil + duration);
}

function updateStatuses(ball) {
  if (ball.slowUntil > 0) {
    ball.slowUntil -= DT;
    if (ball.slowUntil <= 0) ball.tempMaxSpeedRatio = 1;
  }
}

function isEnemyTeam(a, b) {
  return a !== b;
}

function countOwned(list, ownerId) {
  return list.filter((item) => item.ownerId === ownerId).length;
}

function topKey(obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return "none";
  return keys.sort((a, b) => obj[b] - obj[a])[0];
}

function deg(v) { return v * Math.PI / 180; }
function copy(v) { return { x: v.x, y: v.y }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function scale(a, s) { return { x: a.x * s, y: a.y * s }; }
function dot(a, b) { return a.x * b.x + a.y * b.y; }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a, fallback) { const l = len(a); return l > 0.0001 ? scale(a, 1 / l) : copy(fallback || { x: 1, y: 0 }); }
function clampSpeed(v, max) { const l = len(v); return l > max ? scale(v, max / l) : v; }
function distPointSegment(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(dot(ab, ab), 0.0001)));
  return len(sub(p, add(a, scale(ab, t))));
}

module.exports = { Simulation, createDefaultMatch, buildWalls };
