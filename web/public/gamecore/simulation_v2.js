const { createRng } = require("./rng");
const { MAPS, MODES, BALL_BY_ID, MOVEMENT_TUNING } = require("./configs_v2");

const DT = 1 / 60;
const TWO_PI = Math.PI * 2;

function createDefaultMatch(modeId) {
  const mode = MODES[modeId || "ONE_VS_ONE"];
  const presets = {
    A1: { x: -260, y: -80, angle: 22, ballId: "B02_SWORD" },
    A2: { x: -310, y: 150, angle: -32, ballId: "B03_ARCHER" },
    B1: { x: 260, y: 80, angle: 202, ballId: "B07_SAW" },
    B2: { x: 310, y: -150, angle: 154, ballId: "B12_RICOCHET" },
    B3: { x: 120, y: 285, angle: 238, ballId: "B14_SHIELD" },
    C1: { x: 0, y: 270, angle: 278, ballId: "B08_FLAME" }
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
    this.audioTimes = {};
    this.hitTimes = {};
    this.projectiles = [];
    this.hazards = [];
    this.beams = [];
    this.pendingBeams = [];
    this.effects = [];
    this.result = null;
    this.walls = buildWalls(MAPS[this.config.map]);
    this.balls = this.config.slots.map((slot, index) => createBall(slot, index, this.rng));
  }

  step() {
    if (this.result) return this.result;
    this.tick += 1;
    this.time += DT;
    for (const b of this.balls) {
      if (!b.alive) continue;
      this.updateStatus(b);
      if (b.stunned) {
        b.prev = copy(b.pos);
        b.vel = { x: 0, y: 0 };
        continue;
      }
      b.weaponTimer -= DT;
      b.reflectTimer -= DT;
      b.weaponStopTimer = Math.max(0, (b.weaponStopTimer || 0) - DT);
      this.speedRecovery(b);
      this.activeBias(b);
      b.prev = copy(b.pos);
      b.pos = add(b.pos, scale(b.vel, DT));
      b.travelSinceDrop += len(sub(b.pos, b.prev));
      if (b.knockFlight) {
        b.knockFlight.remaining -= len(sub(b.pos, b.prev));
        if (b.knockFlight.remaining <= 0) b.knockFlight = null;
      }
    }
    for (const b of this.balls) if (b.alive) this.resolveWall(b);
    this.resolveBalls();
    for (const b of this.balls) if (b.alive && !b.stunned) this.runWeapon(b);
    this.updatePendingBeams();
    this.updateProjectiles();
    this.updateHazards();
    this.updateBeams();
    this.updateEffects();
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
      balls: this.balls.map((b) => ({
        id: b.id, slotId: b.slotId, teamId: b.teamId, ballId: b.ballId, name: b.name,
        color: b.color, visual: b.visual, x: b.pos.x, y: b.pos.y, vx: b.vel.x, vy: b.vel.y,
        hp: b.hp, maxHp: b.maxHp, radius: b.radius, alive: b.alive,
        statuses: activeStatusList(b)
      })),
      weapons: this.balls.filter((b) => b.alive).flatMap((b) => weaponParts(b, b.weapon, this.time).map((part) => Object.assign({
        ownerId: b.id, teamId: b.teamId, ballId: b.ballId, ownerX: b.pos.x, ownerY: b.pos.y, color: b.color, visual: b.visual.icon, weaponType: b.weapon.type
      }, part))),
      projectiles: this.projectiles.map((p) => ({ x: p.pos.x, y: p.pos.y, vx: p.vel.x, vy: p.vel.y, radius: p.radius, color: p.color, visual: p.visual, lengthScale: p.lengthScale || 1, material: p.material, super: p.super })),
      hazards: this.hazards.map((h) => ({
        x: h.pos.x, y: h.pos.y, x1: h.from && h.from.x, y1: h.from && h.from.y,
        x2: h.to && h.to.x, y2: h.to && h.to.y, radius: h.radius || 5, color: h.color,
        kind: h.kind, visual: h.visual, armed: h.armedAt ? this.time >= h.armedAt : true,
        nx: h.normal && h.normal.x, ny: h.normal && h.normal.y,
        baseX: h.base && h.base.x, baseY: h.base && h.base.y,
        tipX: h.tip && h.tip.x, tipY: h.tip && h.tip.y,
        armProgress: h.armedAt ? Math.max(0, Math.min(1, 1 - (h.armedAt - this.time) / Math.max(0.001, h.armTime || 0.18))) : 1,
        side: h.side || 0,
        angle: h.angle || 0,
        alpha: Math.max(0.2, Math.min(1, h.life / (h.maxLife || h.life || 1)))
      })),
      beams: this.beams.map((b) => ({ x1: b.from.x, y1: b.from.y, x2: b.to.x, y2: b.to.y, color: b.color, life: b.life, kind: b.kind || "beam", width: b.width }))
        .concat(this.pendingBeams.map((b) => ({ x1: b.from.x, y1: b.from.y, x2: b.to.x, y2: b.to.y, color: b.color, life: Math.max(0, b.fireAt - this.time), kind: "warning", width: b.width })))
      ,
      effects: this.effects.map((e) => ({ x: e.pos.x, y: e.pos.y, vx: e.vel && e.vel.x, vy: e.vel && e.vel.y, color: e.color, kind: e.kind, amount: e.amount, life: e.life, maxLife: e.maxLife, radius: e.radius }))
    };
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  speedRecovery(ball) {
    const speed = len(ball.vel);
    const max = ball.maxSpeed * ball.tempMaxSpeedRatio;
    if (speed >= max * 0.55 || this.isTouching(ball)) return;
    const dir = speed > 0.001 ? scale(ball.vel, 1 / speed) : ball.lastDir;
    ball.vel = scale(dir, Math.min(max, speed + ball.recoverAccel * DT));
  }

  activeBias(ball) {
    const speed = len(ball.vel);
    if (speed < 1) return;
    ball.biasTimer += DT;
    const angle = Math.atan2(ball.vel.y, ball.vel.x);
    const nearAxis = Math.min(Math.abs(Math.sin(angle)), Math.abs(Math.cos(angle))) < 0.035;
    const lowProgress = len(sub(ball.pos, ball.biasAnchor)) < 24;
    if ((nearAxis || lowProgress || ball.sameWallHits >= 4) && ball.biasTimer > 0.45) {
      const sign = ((this.tick + ball.biasSeed) % 2) ? 1 : -1;
      ball.vel = rotate(ball.vel, deg((2 + (ball.biasSeed % 5)) * sign));
      ball.biasTimer = 0;
      ball.sameWallHits = 0;
      ball.biasAnchor = copy(ball.pos);
    }
  }

  resolveWall(ball) {
    for (const wall of this.walls) {
      const d = dot(ball.pos, wall.normal) - wall.c;
      if (d >= ball.radius) continue;
      ball.pos = add(ball.pos, scale(wall.normal, ball.radius - d));
      const vn = dot(ball.vel, wall.normal);
      if (vn < 0) ball.vel = clampSpeed(sub(ball.vel, scale(wall.normal, 2 * vn)), ball.maxSpeed * ball.tempMaxSpeedRatio);
      if (ball.knockFlight && this.canHit(`wallCrash_${ball.id}`, wall.index, 0.08)) {
        this.damage(ball, ball.knockFlight.wallDamage || 40, ball.knockFlight.sourceId, "wallCrash", copy(ball.pos));
      }
      if (ball.pin && ball.pin.lance) {
        ball.pin = null;
        if (ball.statuses) delete ball.statuses.pin;
      }
      ball.sameWallHits = ball.lastWall === wall.index ? ball.sameWallHits + 1 : 1;
      ball.lastWall = wall.index;
      this.emitAudio(ball.audio.wallImpactEvent, ball.id, copy(ball.pos), 0.08, "wall");
      this.onWallHit(ball, wall);
    }
  }

  resolveBalls() {
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i], b = this.balls[j];
        if (!a.alive || !b.alive) continue;
        const delta = sub(b.pos, a.pos);
        const dist = Math.max(len(delta), 0.001);
        const minDist = a.radius + b.radius;
        if (dist >= minDist) {
          a.stuckFrames = 0;
          b.stuckFrames = 0;
          continue;
        }
        const n = scale(delta, 1 / dist);
        const penetration = minDist - dist;
        const totalMass = a.mass + b.mass;
        a.pos = sub(a.pos, scale(n, penetration * (b.mass / totalMass)));
        b.pos = add(b.pos, scale(n, penetration * (a.mass / totalMass)));
        const rv = sub(b.vel, a.vel);
        const velAlong = dot(rv, n);
        if (velAlong < 0) {
          const impulse = -(2 * velAlong) / totalMass;
          a.vel = sub(a.vel, scale(n, impulse * b.mass));
          b.vel = add(b.vel, scale(n, impulse * a.mass));
        } else {
          a.stuckFrames += 1;
          b.stuckFrames += 1;
          if (a.stuckFrames > 2 || b.stuckFrames > 2) {
            const tangent = { x: -n.y, y: n.x };
            a.vel = sub(a.vel, scale(tangent, MOVEMENT_TUNING.unstuckImpulse));
            b.vel = add(b.vel, scale(tangent, MOVEMENT_TUNING.unstuckImpulse));
            a.stuckFrames = 0;
            b.stuckFrames = 0;
          }
        }
        a.vel = clampSpeed(a.vel, a.maxSpeed * a.tempMaxSpeedRatio);
        b.vel = clampSpeed(b.vel, b.maxSpeed * b.tempMaxSpeedRatio);
      }
    }
  }

  runWeapon(ball) {
    const w = ball.weapon;
    if (w.type === "projectile" && ball.weaponTimer <= 0) this.shoot(ball, w);
    if (w.type === "boomerang" && ball.weaponTimer <= 0) this.shoot(ball, w, { boomerang: true });
    if (w.type === "harpoon" && ball.weaponTimer <= 0) this.harpoonBurst(ball, w);
    if (w.type === "conditional" && ball.weaponTimer <= 0) this.arc(ball, w);
    if (w.type === "contactStun" && ball.weaponTimer <= 0) this.contactStun(ball, w);
    if (w.type === "laser" && ball.weaponTimer <= 0) this.laser(ball, w);
    if (w.type === "pulse" && ball.weaponTimer <= 0) this.pulse(ball, w);
    if (w.type === "trail" || w.type === "dot") this.dropTrail(ball, w);
    if (w.type === "fieldZone") this.dropFieldZone(ball, w);
    if (w.type === "mine") this.dropMine(ball, w);
    if (["rotatingPart", "fixedPart", "ring", "multiOrbit", "dualFixed", "reflector", "rotatingShield"].includes(w.type)) this.partHits(ball, w);
  }

  harpoonBurst(ball, w) {
    ball.harpoonShotCounter = (ball.harpoonShotCounter || 0) + 1;
    if (w.burstAfterShots && ball.harpoonShotCounter > w.burstAfterShots) {
      ball.harpoonShotCounter = 0;
      const target = this.nearestEnemy(ball);
      if (!target) return;
      const baseDir = norm(sub(target.pos, ball.pos), ball.lastDir);
      const angle = Math.atan2(baseDir.y, baseDir.x);
      const spread = deg(w.burstAngle || 22.5);
      [-spread, 0, spread].forEach((offset) => this.shoot(ball, w, { harpoon: true, forcedDir: { x: Math.cos(angle + offset), y: Math.sin(angle + offset) }, keepTimer: true }));
      ball.weaponTimer = w.cooldown || 2;
      return;
    }
    this.shoot(ball, w, { harpoon: true });
  }

  shoot(ball, w, extra) {
    if (countOwned(this.projectiles, ball.id) >= w.maxCount) return;
    const target = this.nearestEnemy(ball);
    if (!target) return;
    const dir = extra && extra.forcedDir ? extra.forcedDir : norm(sub(target.pos, ball.pos), ball.lastDir);
    const shotNo = (ball.projectileShotCounter || 0) + 1;
    ball.projectileShotCounter = shotNo;
    const isSuper = !!(w.superEvery && shotNo % w.superEvery === 0);
    const speed = w.projectileSpeed * (isSuper ? (w.superSpeedScale || 1) : 1);
    const damage = w.damage * (isSuper ? (w.superDamageScale || 1) : 1);
    const radius = (w.radius || 5) * (isSuper ? (w.superRadiusScale || 1) : 1);
    const wallBehavior = isSuper && w.superBounceCount ? "bounce" : (w.wallBehavior || "destroy");
    this.projectiles.push({
      id: `p_${ball.id}_${this.tick}_${this.projectiles.length}`,
      ownerId: ball.id, teamId: ball.teamId, pos: add(ball.pos, scale(dir, ball.radius + 9)),
      prev: copy(ball.pos), vel: scale(dir, speed), radius,
      damage, life: w.lifeTime || 3, wallBehavior,
      bounces: isSuper ? (w.superBounceCount || 0) : (w.bounceCount || 0), color: ball.color, visual: w.projectileVisual || w.type,
      explosionRadius: (w.explosionRadius || 0) * (isSuper ? Math.sqrt(w.superRadiusScale || 1) : 1),
      slowRatio: w.slowRatio, slowDuration: w.slowDuration,
      lineDamage: w.lineDamage, lineLife: w.lineLife, lineInterval: w.lineInterval, pullImpulse: w.pullImpulse,
      boomerang: extra && extra.boomerang, harpoon: extra && extra.harpoon,
      maxDistance: w.maxDistance, returnSpeed: w.returnSpeed,
      maxTravelDistance: w.maxTravelMapSideScale ? mapSideLength(MAPS[this.config.map]) * w.maxTravelMapSideScale : w.maxTravelDistance,
      distanceTraveled: 0,
      lengthScale: w.projectileLengthScale || 1,
      material: w.projectileMaterial,
      super: isSuper,
      origin: copy(ball.pos), returning: false
    });
    if (w.recoil) ball.vel = clampSpeed(sub(ball.vel, scale(dir, w.recoil)), ball.maxSpeed);
    if (!(extra && extra.keepTimer)) ball.weaponTimer = w.cooldown || 1;
  }

  contactStun(ball, w) {
    for (const target of this.balls) {
      if (!target.alive || !isEnemyTeam(ball.teamId, target.teamId)) continue;
      const touchingBody = len(sub(target.pos, ball.pos)) <= target.radius + ball.radius + 4;
      const touchingWeapon = this.touchesRotatingWeapon(ball, target);
      if (!touchingBody && !touchingWeapon) continue;
      this.damage(target, w.damage, ball.id, "arcStun", copy(target.pos));
      this.stun(target, w.stunDuration || 0.8);
      if (target.weapon && ["rotatingPart", "multiOrbit", "rotatingShield", "ring"].includes(target.weapon.type)) {
        target.weaponStopTimer = Math.max(target.weaponStopTimer || 0, w.stopRotatingWeaponDuration || w.stunDuration || 1);
        if (typeof target.weaponFrozenAt !== "number" || target.weaponStopTimer <= DT) target.weaponFrozenAt = this.time;
      }
      const comboKey = `${ball.id}_${target.id}`;
      ball.arcCombos = ball.arcCombos || {};
      ball.arcCombos[comboKey] = (ball.arcCombos[comboKey] || 0) + 1;
      if (ball.arcCombos[comboKey] >= (w.comboLimit || 3)) {
        ball.arcCombos[comboKey] = 0;
        const dir = norm(sub(target.pos, ball.pos), ball.lastDir);
        const impulse = w.comboSeparateImpulse || 220;
        target.vel = clampSpeed(add(target.vel, scale(dir, impulse)), target.maxSpeed * 1.6);
        ball.vel = clampSpeed(sub(ball.vel, scale(dir, impulse * 0.7)), ball.maxSpeed * 1.3);
        target.pos = add(target.pos, scale(dir, Math.max(18, target.radius * 0.28)));
        ball.pos = sub(ball.pos, scale(dir, Math.max(12, ball.radius * 0.18)));
      }
      this.effects.push({ pos: copy(target.pos), color: "#fff05c", kind: "shock", life: 0.38, maxLife: 0.38, radius: target.radius * 0.9 });
      ball.weaponTimer = w.cooldown || 1.35;
      return;
    }
  }

  touchesRotatingWeapon(ball, target) {
    if (!target.weapon || !["rotatingPart", "multiOrbit", "rotatingShield", "ring"].includes(target.weapon.type)) return false;
    const parts = weaponParts(target, target.weapon, this.time);
    return parts.some((part) => {
      const hit = weaponHitInfo(target, ball, part, target.weapon);
      return hit.hit;
    });
  }

  updateProjectiles() {
    const kept = [];
    for (const p of this.projectiles) {
      p.life -= DT;
      if (p.life <= 0) continue;
      const owner = this.balls.find((b) => b.id === p.ownerId);
      if (p.boomerang && owner) {
        if (!p.returning && len(sub(p.pos, p.origin)) >= p.maxDistance) p.returning = true;
        if (p.returning) p.vel = scale(norm(sub(owner.pos, p.pos), { x: 1, y: 0 }), p.returnSpeed);
      }
      p.prev = copy(p.pos);
      p.pos = add(p.pos, scale(p.vel, DT));
      p.distanceTraveled = (p.distanceTraveled || 0) + len(sub(p.pos, p.prev));
      if (p.maxTravelDistance && p.distanceTraveled >= p.maxTravelDistance) continue;
      let removed = false;
      for (const wall of this.walls) {
        const d = dot(p.pos, wall.normal) - wall.c;
        if (d >= p.radius) continue;
        if (p.wallBehavior === "bounce" && p.bounces > 0) {
          p.pos = add(p.pos, scale(wall.normal, p.radius - d));
          const vn = dot(p.vel, wall.normal);
          p.vel = sub(p.vel, scale(wall.normal, 2 * vn));
          p.bounces -= 1;
          this.emitAudio("SFX_PROJECTILE_RICOCHET", p.ownerId, copy(p.pos), 0.1, "ricochet");
        } else if (p.wallBehavior === "explode") {
          this.explode(p, p.damage, p.explosionRadius || 44, p.teamId, p.ownerId);
          removed = true;
        } else {
          removed = true;
        }
      }
      if (removed) continue;
      for (const b of this.balls) {
        if (!b.alive || !isEnemyTeam(p.teamId, b.teamId)) continue;
        if (distPointSegment(b.pos, p.prev, p.pos) <= b.radius + p.radius) {
          this.damage(b, p.damage, p.ownerId, "projectile", copy(p.pos));
          if (p.slowRatio) this.slow(b, p.slowRatio, p.slowDuration);
          if (p.harpoon) {
            this.addLine(p.ownerId, p.teamId, p.origin, b.pos, p.lineDamage || 7, p.lineLife || 0.8, p.lineInterval || 0.35);
            b.vel = clampSpeed(add(b.vel, scale(norm(sub(p.origin, b.pos), { x: 1, y: 0 }), p.pullImpulse || 18)), b.maxSpeed * b.tempMaxSpeedRatio);
          }
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
        const hit = h.kind === "line"
          ? distPointSegment(b.pos, h.from, h.to) <= b.radius + (h.radius || 4)
          : h.kind === "spike" && h.base && h.tip
            ? distPointSegment(b.pos, h.base, h.tip) <= b.radius + (h.radius || 8) * 0.55
          : h.kind === "prismZone"
            ? sideOfLine(h.from, h.to, b.pos) === h.side
            : h.kind === "flameRing"
              ? len(sub(b.pos, h.pos)) <= b.radius + (h.hitRadius || h.radius)
            : len(sub(b.pos, h.pos)) <= b.radius + h.radius;
        if (!hit || !this.canHit(h.id, b.id, h.hitInterval || 0.4)) continue;
        this.damage(b, h.damage, h.ownerId, h.kind, copy(b.pos));
        if (h.kind === "spike") this.applySpikeKnockback(h, b);
        if (h.kind === "dot") this.applyCorrosion(b, h);
        if (h.kind === "mine" || h.kind === "dot") h.life = 0;
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

  updateEffects() {
    this.effects = this.effects.filter((e) => {
      e.life -= DT;
      if (e.vel) e.pos = add(e.pos, scale(e.vel, DT));
      return e.life > 0;
    });
  }

  applyBodyDamage() {
    for (const a of this.balls) {
      if (!a.alive || !a.bodyDamage) continue;
      for (const b of this.balls) {
        if (a === b || !b.alive || !isEnemyTeam(a.teamId, b.teamId)) continue;
        if (len(sub(a.pos, b.pos)) <= a.radius + b.radius && this.canHit(`body_${a.id}`, b.id, a.bodyHitInterval)) {
          this.damage(b, a.bodyDamage, a.id, "body", copy(b.pos));
        }
      }
    }
  }

  partHits(ball, w) {
    if (w.aimAtEnemy) {
      const target = this.nearestEnemy(ball);
      if (target) ball.weaponAimDir = norm(sub(target.pos, ball.pos), ball.lastDir);
    } else {
      ball.weaponAimDir = null;
    }
    if (w.wallBounceOrbit) this.updateOrbitWallBounce(ball, w);
    if (ball.weaponStopTimer > 0 && ["rotatingPart", "multiOrbit", "rotatingShield", "ring"].includes(w.type)) return;
    const parts = weaponParts(ball, w, this.time);
    if (w.rigidWallCollision) this.resolveRigidWeaponWalls(ball, w, parts);
    for (const part of parts) {
      for (const target of this.balls) {
        if (!target.alive || !isEnemyTeam(ball.teamId, target.teamId)) continue;
        const hit = weaponHitInfo(ball, target, part, w);
        if (hit.hit) {
          const point = this.resolveWeaponContact(ball, target, part, w, hit);
          if (!this.canHit(`${w.type}_${ball.id}`, target.id, w.hitInterval || 0.35)) continue;
          const sourceType = weaponSourceType(w, ball);
          const amount = this.weaponDamage(ball, target, part, w);
          this.damage(target, amount, ball.id, sourceType, point);
          if (w.stickyLance && sourceType === "lancePierce") this.pinTarget(ball, target, w, "lance");
          if (w.tipDamageMultiplier && sourceType === "drillTip") this.pinTarget(ball, target, w);
          if (w.launchOnHit && sourceType === "flailHead") this.launchTarget(ball, target, w);
        }
      }
    }
    if (!["reflector", "rotatingShield"].includes(w.type) || ball.reflectTimer > 0) return;
    for (const p of this.projectiles) {
      if (!isEnemyTeam(ball.teamId, p.teamId)) continue;
      if (w.style === "shield" && !isInShieldArc(ball, p.pos, w.angle || 160)) continue;
      if (!parts.some((part) => len(sub(part.pos, p.pos)) <= part.radius + p.radius)) continue;
      if (w.canReflect === false) {
        p.life = 0;
        ball.reflectTimer = w.cooldown || 0.25;
        this.emitAudio("SFX_SHIELD_BLOCK", ball.id, copy(p.pos), 0.12, "block");
        this.effects.push({ pos: copy(p.pos), vel: norm(sub(p.pos, ball.pos), ball.lastDir), color: ball.visual.secondaryColor || ball.color, kind: "impact", life: 0.14, maxLife: 0.14, radius: Math.max(16, p.radius * 1.4) });
        continue;
      }
      p.ownerId = ball.id;
      p.teamId = ball.teamId;
      p.vel = scale(norm(sub(p.pos, ball.pos), ball.lastDir), len(p.vel));
      p.damage *= w.reflectDamageRatio || 0.8;
      ball.reflectTimer = w.cooldown || 0.25;
      this.emitAudio(ball.ballId === "B22_PRISM" ? "SFX_PRISM_REFLECT" : "SFX_SHIELD_REFLECT", ball.id, copy(p.pos), 0.12, "reflect");
      if (w.style === "prism" && this.canHit(`refract_${ball.id}`, p.id, w.refractCooldown || 0.55)) {
        const dir = rotate(norm(p.vel, ball.lastDir), deg(28));
        const end = add(p.pos, scale(dir, 520));
        this.beams.push({ from: copy(p.pos), to: end, color: ball.visual.secondaryColor || ball.color, life: 0.16, width: 5, kind: "refract" });
        for (const target of this.balls) {
          if (!target.alive || !isEnemyTeam(ball.teamId, target.teamId)) continue;
          if (distPointSegment(target.pos, p.pos, end) <= target.radius + 8) this.damage(target, w.refractDamage || 24, ball.id, "prismRefract", copy(target.pos));
        }
      }
    }
  }

  updateOrbitWallBounce(ball, w) {
    const count = w.count || 1;
    const speed = deg(w.angularSpeed || 0) * DT;
    if (!ball.orbitDirs || ball.orbitDirs.length !== count) {
      ball.orbitDirs = [];
      for (let i = 0; i < count; i++) {
        const a = i * TWO_PI / count;
        ball.orbitDirs.push({ x: Math.cos(a), y: Math.sin(a) });
      }
    }
    for (let i = 0; i < ball.orbitDirs.length; i++) {
      let dir = rotate(ball.orbitDirs[i], speed);
      let pos = add(ball.pos, scale(dir, w.orbitRadius || 40));
      for (const wall of this.walls) {
        const d = dot(pos, wall.normal) - wall.c;
        if (d >= (w.radius || 12)) continue;
        dir = norm(sub(dir, scale(wall.normal, 2 * dot(dir, wall.normal))), dir);
        pos = add(ball.pos, scale(dir, w.orbitRadius || 40));
        this.effects.push({ pos: copy(pos), vel: scale(wall.normal, 120), color: ball.visual.secondaryColor || ball.color, kind: "star", life: 0.16, maxLife: 0.16, radius: w.radius || 14 });
        break;
      }
      ball.orbitDirs[i] = dir;
    }
  }

  resolveRigidWeaponWalls(ball, w, parts) {
    for (const part of parts) {
      for (const wall of this.walls) {
        const d = dot(part.pos, wall.normal) - wall.c;
        if (d >= part.radius) continue;
        const push = part.radius - d;
        ball.pos = add(ball.pos, scale(wall.normal, Math.min(push, ball.radius * 0.32)));
        const vn = dot(ball.vel, wall.normal);
        if (vn < 0) ball.vel = clampSpeed(sub(ball.vel, scale(wall.normal, 2 * vn)), ball.maxSpeed * ball.tempMaxSpeedRatio);
        if (this.canHit(`rigidWall_${ball.id}`, wall.index, 0.12)) {
          this.emitAudio(ball.audio.wallImpactEvent, ball.id, copy(part.pos), 0.1, "weaponWall");
          this.effects.push({ pos: copy(part.pos), vel: scale(wall.normal, 150), color: ball.visual.secondaryColor || ball.color, kind: "star", life: 0.16, maxLife: 0.16, radius: part.radius * 0.55 });
        }
      }
    }
  }

  weaponDamage(source, target, part, w) {
    let amount = w.damage;
    if (w.rageDamageScale) {
      const missing = Math.max(0, 1 - source.hp / source.maxHp);
      const steps = Math.floor(missing / (w.rageDamageScale.missingHpStep || 0.1));
      const bonus = Math.min(w.rageDamageScale.maxBonus || 0.6, steps * (w.rageDamageScale.damageBonusPerStep || 0.06));
      amount *= 1 + bonus;
    }
    if (w.tipDamageMultiplier && isTipHit(source, target, w)) amount *= w.tipDamageMultiplier;
    if (w.lowHpDamageBonus && source.hp / source.maxHp < (w.lowHpThreshold || 0.5)) amount += w.lowHpDamageBonus;
    return amount;
  }

  pinTarget(source, target, w, mode) {
    target.pin = { sourceId: source.id, duration: mode === "lance" ? 999 : (w.pinDuration || 1.35), lance: mode === "lance", damage: w.damage, hitInterval: w.hitInterval || 0.22 };
    target.statuses.pin = { duration: target.pin.duration };
  }

  launchTarget(source, target, w) {
    const dir = norm(sub(target.pos, source.pos), source.lastDir);
    const side = mapSideLength(MAPS[this.config.map]);
    target.knockFlight = { sourceId: source.id, remaining: side * (w.launchDistanceMapSide || 1), wallDamage: w.wallCrashDamage || 40 };
    target.vel = scale(dir, Math.max(target.maxSpeed * 1.85, side * 1.15));
    this.effects.push({ pos: copy(target.pos), vel: scale(dir, 240), color: source.visual.secondaryColor || source.color, kind: "impact", life: 0.24, maxLife: 0.24, radius: target.radius * 0.85 });
  }

  weaponImpulse(source, target, w) {
    if (!w.impulse) return;
    const dir = norm(sub(target.pos, source.pos), source.lastDir);
    const amount = w.impulse * MOVEMENT_TUNING.weaponImpulseScale;
    source.vel = clampSpeed(sub(source.vel, scale(dir, amount * 0.45)), source.maxSpeed);
    target.vel = clampSpeed(add(target.vel, scale(dir, amount)), target.maxSpeed);
  }

  resolveWeaponContact(source, target, part, w, hit) {
    const contact = hit && hit.point ? hit.point : part.pos;
    const n = hit && hit.normal ? hit.normal : norm(sub(target.pos, contact), norm(sub(target.pos, source.pos), source.lastDir));
    const dist = Math.max(hit && typeof hit.distance === "number" ? hit.distance : len(sub(target.pos, contact)), 0.001);
    const weaponRadius = hit && typeof hit.weaponRadius === "number" ? hit.weaponRadius : part.radius;
    const penetration = Math.max(0, target.radius + weaponRadius - dist);
    if (penetration > 0) {
      target.pos = add(target.pos, scale(n, penetration + 1.5));
      source.pos = sub(source.pos, scale(n, Math.min(8, penetration * 0.08)));
    }
    const rv = sub(target.vel, source.vel);
    const closing = Math.max(0, -dot(rv, n));
    const baseImpulse = Math.max(w.impulse || 0, part.radius * 0.22, len(source.vel) * 0.35, 18);
    const solidBonus = ["fixedPart", "dualFixed", "rotatingShield", "ring"].includes(w.type) ? 12 : 0;
    const impulse = baseImpulse + solidBonus + closing * 0.55;
    target.vel = clampSpeed(add(target.vel, add(scale(n, impulse), scale(source.vel, 0.18))), target.maxSpeed * target.tempMaxSpeedRatio);
    source.vel = clampSpeed(sub(source.vel, scale(n, impulse * 0.18)), source.maxSpeed * source.tempMaxSpeedRatio);
    if (this.canHit(`fx_${source.id}`, target.id, 0.08)) {
      this.effects.push({ pos: add(contact, scale(n, weaponRadius * 0.35)), vel: scale(n, impulse * 3.5), color: source.visual.secondaryColor || source.color, kind: "impact", life: 0.16, maxLife: 0.16, radius: Math.max(16, weaponRadius * 0.75) });
    }
    return add(contact, scale(n, weaponRadius * 0.55));
  }

  arc(ball, w) {
    const target = this.nearestEnemy(ball);
    if (!target || len(sub(target.pos, ball.pos)) > w.range) return;
    this.damage(target, w.damage, ball.id, "arc", copy(target.pos));
    this.beams.push({ from: copy(ball.pos), to: copy(target.pos), color: ball.color, life: 0.12 });
    ball.weaponTimer = w.cooldown;
  }

  laser(ball, w) {
    const target = this.nearestEnemy(ball);
    if (!target) return;
    const dir = norm(sub(target.pos, ball.pos), ball.lastDir);
    const length = w.lengthMapSideScale ? mapSideLength(MAPS[this.config.map]) * w.lengthMapSideScale : 900;
    const end = add(ball.pos, scale(dir, length));
    this.pendingBeams.push({
      ownerId: ball.id, teamId: ball.teamId, from: copy(ball.pos), to: end, dir,
      color: ball.color, damage: w.damage, width: w.width || 7,
      fireAt: this.time + (w.warningTime || 0.35), duration: w.beamDuration || 0.14
    });
    this.emitAudio("SFX_LASER_CHARGE", ball.id, copy(ball.pos), 0.35, "warning");
    ball.weaponTimer = w.cooldown || 2.35;
  }

  updatePendingBeams() {
    const kept = [];
    for (const beam of this.pendingBeams) {
      if (this.time < beam.fireAt) {
        kept.push(beam);
        continue;
      }
      this.beams.push({ from: copy(beam.from), to: copy(beam.to), color: beam.color, life: beam.duration, width: beam.width, kind: "laser" });
      for (const b of this.balls) {
        if (!b.alive || !isEnemyTeam(beam.teamId, b.teamId)) continue;
        if (distPointSegment(b.pos, beam.from, beam.to) <= b.radius + beam.width) {
          this.damage(b, beam.damage, beam.ownerId, "laserBeam", copy(b.pos));
        }
      }
    }
    this.pendingBeams = kept;
  }

  pulse(ball, w) {
    if (!this.balls.some((b) => b.alive && isEnemyTeam(ball.teamId, b.teamId) && len(sub(b.pos, ball.pos)) <= w.triggerRange)) return;
    for (const b of this.balls) {
      if (!b.alive || !isEnemyTeam(ball.teamId, b.teamId) || len(sub(b.pos, ball.pos)) > w.pulseRadius) continue;
      this.damage(b, w.damage, ball.id, "pulse", copy(b.pos));
      b.vel = clampSpeed(add(b.vel, scale(norm(sub(b.pos, ball.pos), { x: 1, y: 0 }), w.impulse || 20)), b.maxSpeed);
    }
    this.hazards.push({ id: `pulse_${ball.id}_${this.tick}`, kind: "pulse", ownerId: ball.id, teamId: ball.teamId, pos: copy(ball.pos), radius: w.pulseRadius, damage: 0, life: 0.18, maxLife: 0.18, color: ball.color, visual: "pulse" });
    ball.weaponTimer = w.cooldown;
  }

  dropTrail(ball, w) {
    if (ball.travelSinceDrop < w.spawnDistance || countOwned(this.hazards, ball.id) >= w.maxCount) return;
    const kind = w.type === "dot" ? "dot" : "line";
    const base = kind === "dot" ? { pos: copy(ball.pos), radius: w.radius || 16 } : { from: copy(ball.prev), to: copy(ball.pos), pos: copy(ball.pos), radius: 4 };
    this.hazards.push(Object.assign(base, {
      id: `${kind}_${ball.id}_${this.tick}`, kind, ownerId: ball.id, teamId: ball.teamId,
      damage: w.damage, hitInterval: w.hitInterval || 0.4, life: w.lifeTime, maxLife: w.lifeTime,
      dotDamage: w.dotDamage, dotDuration: w.dotDuration, maxStacks: w.maxStacks || 2, speedRatio: w.speedRatio || 0.94,
      color: ball.color, visual: w.hazardVisual || kind, ownerGraceUntil: this.time + (w.ownerGrace || 0)
    }));
    ball.travelSinceDrop = 0;
  }

  dropMine(ball, w) {
    const owned = countOwned(this.hazards, ball.id);
    if (owned >= w.maxCount) return;
    const filledOnce = (ball.minePlacedCount || 0) >= (w.maxCount || 4);
    if ((!w.stableFill || !filledOnce) && ball.weaponTimer > 0) return;
    if (ball.travelSinceDrop < (w.moveDistance || 0)) return;
    this.hazards.push({ id: `mine_${ball.id}_${this.tick}`, kind: "mine", ownerId: ball.id, teamId: ball.teamId, pos: copy(ball.pos), radius: w.radius, damage: w.damage, hitInterval: 0.5, life: w.lifeTime, maxLife: w.lifeTime, armedAt: this.time + w.armTime, color: ball.color, visual: "mineDisk" });
    ball.minePlacedCount = (ball.minePlacedCount || 0) + 1;
    ball.travelSinceDrop = 0;
    ball.weaponTimer = w.cooldown;
  }

  dropFieldZone(ball, w) {
    if (ball.weaponTimer > 0 || countOwned(this.hazards, ball.id) >= (w.maxCount || 2)) return;
    this.hazards.push({ id: `field_${ball.id}_${this.tick}`, kind: "fieldZone", ownerId: ball.id, teamId: ball.teamId, pos: copy(ball.pos), radius: w.pulseRadius, damage: w.damage, hitInterval: w.hitInterval || 0.45, life: w.lifeTime || 2.2, maxLife: w.lifeTime || 2.2, color: ball.color, visual: "fieldZone" });
    ball.weaponTimer = w.cooldown || 2;
  }

  onWallHit(ball, wall) {
    const w = ball.weapon;
    if ((w.type === "wallDrop" || w.type === "wallSpikeTrap") && ball.weaponTimer <= 0 && countOwned(this.hazards, ball.id) < (w.maxCount || Infinity)) {
      const d = dot(ball.pos, wall.normal) - wall.c;
      const base = sub(ball.pos, scale(wall.normal, d));
      if (this.hasNearbySpike(ball.id, wall.index, base, w.dedupDistance || ball.radius * 1.05)) return;
      const length = Math.max(ball.radius * 1.18, (w.radius || 28) * 2.45) * (w.spikeLengthScale || 1);
      const tip = add(base, scale(wall.normal, length));
      const pos = add(base, scale(wall.normal, length * 0.5));
      const armTime = w.armTime || 0.18;
      this.hazards.push({
        id: `spike_${ball.id}_${this.tick}`, kind: "spike", wallIndex: wall.index,
        ownerId: ball.id, teamId: "NEUTRAL", pos, base, tip, normal: copy(wall.normal),
        radius: w.radius, length, damage: w.damage, hitInterval: w.hitInterval,
        life: w.lifeTime, maxLife: w.lifeTime, armedAt: this.time + armTime, armTime,
        color: ball.color, visual: "spike", angle: Math.atan2(wall.normal.x, -wall.normal.y),
        ownerImmunity: w.ownerImmunity !== false
      });
      ball.weaponTimer = w.cooldown;
    }
    if (w.type === "wallSegmentTrail") this.recordThreadWallHit(ball, w, wall);
    if (w.type === "flameBurstTrail" && ball.weaponTimer <= 0) {
      const d = dot(ball.pos, wall.normal) - wall.c;
      const base = sub(ball.pos, scale(wall.normal, d));
      let pos = add(base, scale(wall.normal, (w.radius || 0) + 2));
      pos = keepCircleInsideArena(pos, w.radius || 0, this.walls);
      const owned = this.hazards.filter((h) => h.ownerId === ball.id && h.visual === "flameTrail");
      if (owned.length >= (w.maxCount || 2)) {
        owned.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const removeId = owned[0].id;
        this.hazards = this.hazards.filter((h) => h.id !== removeId);
      }
      this.hazards.push({ id: `flame_${ball.id}_${this.tick}_${this.hazards.length}`, kind: "flameRing", ownerId: ball.id, teamId: ball.teamId, pos, radius: w.radius, hitRadius: w.radius, damage: w.damage, hitInterval: w.hitInterval || 0.3, life: w.lifeTime, maxLife: w.lifeTime, createdAt: this.tick, color: ball.color, visual: "flameTrail" });
      ball.weaponTimer = w.cooldown || 0.5;
    }
    if (w.type === "prismPartition") this.recordPrismWallHit(ball, w, wall);
    if (w.type === "wallBurst" && ball.weaponTimer <= 0) {
      for (let i = 0; i < w.count && countOwned(this.projectiles, ball.id) < w.maxCount; i++) {
        const base = Math.atan2(wall.normal.y, wall.normal.x);
        const offset = ((i / Math.max(w.count - 1, 1)) - 0.5) * deg(w.spreadAngle);
        const dir = { x: Math.cos(base + offset), y: Math.sin(base + offset) };
        this.projectiles.push({ id: `shard_${ball.id}_${this.tick}_${i}`, ownerId: ball.id, teamId: ball.teamId, pos: copy(ball.pos), prev: copy(ball.pos), vel: scale(dir, w.projectileSpeed), radius: w.radius, damage: w.damage, life: w.lifeTime, wallBehavior: "destroy", bounces: 0, color: ball.color, visual: w.projectileVisual || "shard" });
      }
      ball.weaponTimer = w.cooldown;
    }
  }

  hasNearbySpike(ownerId, wallIndex, pos, distance) {
    return this.hazards.some((h) => h.kind === "spike" && h.ownerId === ownerId && h.wallIndex === wallIndex && len(sub(h.pos, pos)) < distance);
  }

  recordThreadWallHit(ball, w, wall) {
    ball.threadWallPoints = ball.threadWallPoints || [];
    const point = copy(ball.pos);
    const prev = ball.threadWallPoints[ball.threadWallPoints.length - 1];
    ball.threadWallPoints.push(point);
    if (prev && len(sub(prev, point)) > 80) {
      this.hazards = this.hazards.filter((h) => !(h.kind === "line" && h.visual === "threadLine" && h.ownerId === ball.id));
      const points = ball.threadWallPoints.slice(-3);
      for (let i = 1; i < points.length; i++) {
        this.hazards.push({ id: `thread_${ball.id}_${this.tick}_${i}`, kind: "line", ownerId: ball.id, teamId: ball.teamId, from: copy(points[i - 1]), to: copy(points[i]), pos: copy(points[i]), radius: w.lineWidth || 12, damage: w.damage, hitInterval: w.hitInterval || 0.4, life: 999, maxLife: 999, color: ball.color, visual: "threadLine", ownerGraceUntil: this.time + (w.ownerGrace || 0.75) });
      }
    }
    ball.threadWallPoints = ball.threadWallPoints.slice(-3);
  }

  recordPrismWallHit(ball, w, wall) {
    ball.prismWallPoints = ball.prismWallPoints || [];
    const point = copy(ball.pos);
    const prev = ball.prismWallPoints[ball.prismWallPoints.length - 1];
    if (prev && len(sub(prev, point)) < (w.minPointDistance || 180)) return;
    ball.prismWallPoints.push(point);
    ball.prismWallPoints = ball.prismWallPoints.slice(-2);
    if (ball.prismWallPoints.length < 2) return;
    const a = ball.prismWallPoints[0], b = ball.prismWallPoints[1];
    this.hazards = this.hazards.filter((h) => h.kind !== "prismZone" || h.ownerId !== ball.id);
    const enemy = this.nearestEnemy(ball);
    const side = enemy ? sideOfLine(a, b, enemy.pos) : 1;
    this.hazards.push({ id: `prism_zone_${ball.id}_${this.tick}`, kind: "prismZone", ownerId: ball.id, teamId: ball.teamId, from: copy(a), to: copy(b), pos: scale(add(a, b), 0.5), side, radius: 8, damage: w.zoneDamage || 12, hitInterval: w.zoneInterval || 0.5, life: 8, maxLife: 8, color: ball.color, visual: "prismZone" });
  }

  addLine(ownerId, teamId, from, to, damage, life, hitInterval) {
    this.hazards.push({ id: `harpoon_line_${ownerId}_${this.tick}`, kind: "line", ownerId, teamId, from: copy(from), to: copy(to), pos: copy(to), radius: 4, damage, hitInterval: hitInterval || 0.35, life, maxLife: life, color: "#a7b0b8", visual: "harpoonLine" });
  }

  applySpikeKnockback(spike, target) {
    const n = spike.normal || norm(sub(target.pos, spike.pos), { x: 0, y: -1 });
    const impulse = 22 + Math.min(34, spike.damage * 0.25);
    target.vel = clampSpeed(add(target.vel, scale(n, impulse)), target.maxSpeed * target.tempMaxSpeedRatio);
    this.effects.push({
      pos: spike.tip ? copy(spike.tip) : copy(target.pos),
      vel: scale(n, impulse * 3),
      color: "#b8ffd0",
      kind: "impact",
      life: 0.16,
      maxLife: 0.16,
      radius: Math.max(18, (spike.radius || 12) * 0.9)
    });
  }

  explode(p, damage, radius, teamId, ownerId) {
    for (const b of this.balls) if (b.alive && isEnemyTeam(teamId, b.teamId) && len(sub(b.pos, p.pos)) <= b.radius + radius) this.damage(b, damage, ownerId, "explosion", copy(b.pos));
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

  isTouching(ball) {
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

  damage(target, amount, sourceId, sourceType, point) {
    if (!target.alive || amount <= 0) return;
    const source = this.balls.find((b) => b.id === sourceId);
    const crit = this.rollCrit(source);
    if (crit) amount *= crit.multiplier;
    const hpBefore = target.hp;
    const wasAlive = target.alive && hpBefore > 0;
    target.hp = Math.max(0, target.hp - amount);
    const hpAfter = target.hp;
    const killed = wasAlive && hpAfter <= 0;
    target.damageTaken += amount;
    if (source) {
      source.damageDone += amount;
      source.hits += 1;
      source.damageByType[sourceType] = (source.damageByType[sourceType] || 0) + amount;
    }
    const event = {
      time: this.time,
      type: "damage",
      sourceId,
      targetId: target.id,
      amount,
      sourceType,
      point: point || copy(target.pos),
      crit: crit && crit.level,
      hpBefore,
      hpAfter,
      killed
    };
    if (this.canHit(`num_${target.id}`, sourceType, sourceType === "corrosionDot" ? 0.35 : 0.08)) {
      const numberColor = crit ? crit.color : sourceType === "corrosionDot" ? "#67ff5c" : "#ffffff";
      this.effects.push({ pos: point || copy(target.pos), vel: { x: 0, y: -80 }, color: numberColor, kind: "damageNumber", amount: Math.round(amount), life: 0.45, maxLife: 0.45, radius: amount >= 45 ? 34 : 28 });
    }
    if (source) {
      event.audioEvent = source.audio.attackHitEvent;
      event.effect = source.visual.hitEffect;
      this.emitAudio(source.audio.attackHitEvent, sourceId, event.point, source.audio.minSameSourceInterval, "hit");
      this.effects.push({ pos: event.point, color: source.visual.secondaryColor || source.color, kind: source.visual.icon, life: 0.18, maxLife: 0.18, radius: 18 });
    }
    this.events.push(event);
    if (killed) {
      target.alive = false;
      this.emitAudio("SFX_ELIMINATION_POP", target.id, copy(target.pos), 0.2, "eliminate");
    }
  }

  rollCrit(source) {
    const crit = source && source.weapon && source.weapon.crit;
    if (!crit) return null;
    const roll = this.rng.next();
    const highRate = crit.highRate || 0;
    if (highRate > 0 && roll < highRate) return { level: "high", multiplier: crit.highMultiplier || 3, color: "#ff3b30" };
    const midRate = crit.midRate || 0;
    if (midRate > 0 && roll < highRate + midRate) return { level: "mid", multiplier: crit.midMultiplier || 2, color: "#ffd536" };
    return null;
  }

  emitAudio(eventName, sourceId, point, interval, kind) {
    const key = `${sourceId}_${eventName}`;
    if ((this.audioTimes[key] || -999) + interval > this.time) return;
    this.audioTimes[key] = this.time;
    this.events.push({ time: this.time, type: "audio", eventName, sourceId, point, kind });
  }

  slow(ball, ratio, duration) {
    ball.slowRatio = Math.min(ball.slowRatio || 1, ratio);
    ball.tempMaxSpeedRatio = Math.min(ball.tempMaxSpeedRatio, ratio);
    ball.slowUntil = Math.max(ball.slowUntil, duration);
    ball.vel = clampSpeed(ball.vel, ball.maxSpeed * ball.tempMaxSpeedRatio);
    this.effects.push({ pos: copy(ball.pos), vel: { x: 0, y: -60 }, color: "#8fdcff", kind: "shock", life: 0.28, maxLife: 0.28, radius: ball.radius * 0.72 });
  }

  applyCorrosion(ball, hazard) {
    ball.statuses = ball.statuses || {};
    const prev = ball.statuses.corrosion || { stacks: 0, tickTimer: 0 };
    ball.statuses.corrosion = {
      stacks: Math.min(hazard.maxStacks || 2, prev.stacks + 1),
      duration: hazard.dotDuration || 3,
      tickTimer: Math.min(prev.tickTimer || 0, 0.5),
      damage: hazard.dotDamage || 4,
      speedRatio: hazard.speedRatio || 0.94,
      sourceId: hazard.ownerId
    };
  }

  updateStatus(ball) {
    ball.stunned = false;
    ball.tempMaxSpeedRatio = 1;
    if (ball.stunUntil && ball.stunUntil > this.time) {
      ball.stunned = true;
      ball.tempMaxSpeedRatio = 0;
      if (ball.statuses.stun) ball.statuses.stun.duration = ball.stunUntil - this.time;
    } else if (ball.statuses && ball.statuses.stun) {
      delete ball.statuses.stun;
    }
    if (ball.pin) {
      const source = this.balls.find((b) => b.id === ball.pin.sourceId && b.alive);
      ball.pin.duration -= DT;
      if (!source || ball.pin.duration <= 0 || this.isNearWall(ball)) {
        ball.pin = null;
        if (ball.statuses) delete ball.statuses.pin;
      } else {
        const dir = ball.pin.lance ? norm(source.vel, source.lastDir) : norm(source.vel, source.lastDir);
        const pushSpeed = ball.pin.lance ? Math.max(source.maxSpeed * 1.08, ball.maxSpeed * 0.92) : source.maxSpeed * 0.62;
        ball.vel = clampSpeed(add(scale(dir, pushSpeed), scale(ball.vel, ball.pin.lance ? 0.08 : 0.2)), Math.max(ball.maxSpeed, pushSpeed));
        if (ball.pin.lance && this.canHit(`lancePin_${source.id}`, ball.id, ball.pin.hitInterval || 0.22)) {
          this.damage(ball, ball.pin.damage || 12, source.id, "lancePin", copy(ball.pos));
        }
        ball.statuses.pin.duration = ball.pin.duration;
      }
    }
    if (ball.slowUntil > 0) {
      ball.slowUntil -= DT;
      if (ball.slowUntil > 0) ball.tempMaxSpeedRatio = Math.min(ball.tempMaxSpeedRatio, ball.slowRatio || 0.82);
      else ball.slowRatio = 1;
    }
    if (ball.statuses && ball.statuses.corrosion) {
      const c = ball.statuses.corrosion;
      c.duration -= DT;
      c.tickTimer -= DT;
      ball.tempMaxSpeedRatio = Math.min(ball.tempMaxSpeedRatio, c.speedRatio || 0.94);
      if (c.tickTimer <= 0) {
        c.tickTimer += 0.5;
        this.damage(ball, (c.damage || 4) * (c.stacks || 1), c.sourceId, "corrosionDot", copy(ball.pos));
      }
      if (c.duration <= 0) delete ball.statuses.corrosion;
    }
  }

  stun(ball, duration) {
    ball.stunUntil = Math.max(ball.stunUntil || 0, this.time + duration);
    ball.statuses.stun = { duration };
  }

  isNearWall(ball) {
    return this.walls.some((wall) => dot(ball.pos, wall.normal) - wall.c <= ball.radius + 2);
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
        slotId: b.slotId, teamId: b.teamId, ballId: b.ballId, name: b.name, hp: Math.round(b.hp),
        damageDone: Math.round(b.damageDone), damageTaken: Math.round(b.damageTaken), hits: b.hits,
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

function createBall(slot, index, rng) {
  const cfg = BALL_BY_ID[slot.ballId] || BALL_BY_ID.B02_SWORD;
  const stats = cfg.stats;
  const angle = deg(slot.initialAngleDeg || 0);
  const vel = slot.initialVelocity ? clampSpeed(copy(slot.initialVelocity), stats.maxSpeed) : { x: Math.cos(angle) * stats.initialSpeed, y: Math.sin(angle) * stats.initialSpeed };
  return {
    id: slot.slotId, slotId: slot.slotId, teamId: slot.teamId, ballId: cfg.id, name: cfg.name, color: cfg.color,
    visual: cfg.visual, audio: cfg.audio, pos: copy(slot.spawn || { x: 0, y: 0 }), prev: copy(slot.spawn || { x: 0, y: 0 }),
    vel, lastDir: norm(vel, { x: Math.cos(angle), y: Math.sin(angle) }), radius: stats.radius, mass: stats.mass,
    hp: stats.hp, maxHp: stats.hp, maxSpeed: stats.maxSpeed, recoverAccel: stats.recoverAccel,
    bodyDamage: stats.bodyDamage, bodyHitInterval: stats.bodyHitInterval, weapon: cfg.weapon,
    weaponTimer: cfg.weapon.type === "mine" ? (cfg.weapon.cooldown || 2) : index * 0.11 + (rng ? rng.next() * 0.09 : 0), reflectTimer: 0, tempMaxSpeedRatio: 1, slowUntil: 0, travelSinceDrop: cfg.weapon.type === "mine" ? 0 : 999,
    alive: true, damageDone: 0, damageTaken: 0, hits: 0, damageByType: {}, statuses: {},
    stuckFrames: 0, lastWall: -1, sameWallHits: 0, biasTimer: 0,
    biasSeed: index * 17 + Math.round((slot.initialAngleDeg || 0) * 3) + (rng ? Math.floor(rng.next() * 997) : 0), biasAnchor: copy(slot.spawn || { x: 0, y: 0 })
  };
}

function buildWalls(map) {
  const sides = map.sides;
  const circum = map.radius / Math.cos(Math.PI / sides);
  const verts = [];
  const start = -Math.PI / 2 + (sides === 4 ? Math.PI / 4 : 0);
  for (let i = 0; i < sides; i++) verts.push({ x: Math.cos(start + i * TWO_PI / sides) * circum, y: Math.sin(start + i * TWO_PI / sides) * circum });
  return verts.map((a, i) => {
    const b = verts[(i + 1) % verts.length];
    const edge = sub(b, a);
    let normal = norm({ x: -edge.y, y: edge.x }, { x: 0, y: 1 });
    if (dot(normal, scale(add(a, b), 0.5)) > 0) normal = scale(normal, -1);
    return { a, b, normal, c: dot(a, normal), index: i };
  });
}

function mapSideLength(map) {
  const sides = map.sides;
  const circum = map.radius / Math.cos(Math.PI / sides);
  return 2 * circum * Math.sin(Math.PI / sides);
}

function weaponParts(ball, w, time) {
  if (ball.weaponStopTimer > 0 && typeof ball.weaponFrozenAt === "number") time = ball.weaponFrozenAt;
  const moveDir = norm(ball.vel, ball.lastDir);
  if (len(ball.vel) > 1) ball.lastDir = moveDir;
  const speedDir = ball.weaponAimDir || moveDir;
  if (w.noBodyTrail || w.type === "flameBurstTrail") return [];
  if (w.type === "ring") return [{ pos: copy(ball.pos), radius: w.radius, angle: 0, length: w.radius * 2 }];
  if (w.type === "reflector" && w.style === "shield") return [{ pos: add(ball.pos, scale(speedDir, (w.radius || 48) * 0.7)), radius: w.radius || 48, angle: Math.atan2(speedDir.y, speedDir.x), length: w.length || 52, width: w.width || 12, arc: w.angle || 160 }];
  if (w.type === "rotatingShield") return [{
    pos: add(ball.pos, scale(speedDir, (w.radius || 60) * 0.72)),
    radius: w.radius || 60,
    angle: Math.atan2(speedDir.y, speedDir.x),
    length: w.length || w.radius || 78,
    width: w.width || 18,
    arc: w.shieldAngle || w.angle || 160
  }];
  if (w.type === "fixedPart") {
    const base = add(ball.pos, scale(speedDir, ball.radius * 0.35));
    const tip = add(ball.pos, scale(speedDir, (w.offset || 0) + (w.length || 0) * 0.62));
    return [{ pos: add(ball.pos, scale(speedDir, w.offset)), from: base, to: tip, radius: Math.max(w.width, w.length * 0.32), hitRadius: Math.max(7, w.width * 0.68), angle: Math.atan2(speedDir.y, speedDir.x), length: w.length, width: w.width }];
  }
  if (w.type === "dualFixed") {
    const side = { x: -speedDir.y, y: speedDir.x };
    return [
      { pos: add(ball.pos, scale(side, w.offset)), from: add(ball.pos, scale(side, ball.radius * 0.38)), to: add(ball.pos, scale(side, (w.offset || 0) + (w.length || 0) * 0.58)), radius: w.length * 0.42, hitRadius: Math.max(7, w.width * 0.72), angle: Math.atan2(side.y, side.x), length: w.length, width: w.width },
      { pos: sub(ball.pos, scale(side, w.offset)), from: sub(ball.pos, scale(side, ball.radius * 0.38)), to: sub(ball.pos, scale(side, (w.offset || 0) + (w.length || 0) * 0.58)), radius: w.length * 0.42, hitRadius: Math.max(7, w.width * 0.72), angle: Math.atan2(-side.y, -side.x), length: w.length, width: w.width }
    ];
  }
  const count = w.count || 1;
  const points = [];
  const angular = deg(w.angularSpeed || 0) * time;
  for (let i = 0; i < count; i++) {
    const bounceDir = w.wallBounceOrbit && ball.orbitDirs && ball.orbitDirs[i];
    const a = bounceDir ? Math.atan2(bounceDir.y, bounceDir.x) : angular + i * TWO_PI / count;
    const dir = bounceDir || { x: Math.cos(a), y: Math.sin(a) };
    const pos = add(ball.pos, scale(dir, w.orbitRadius || 40));
    points.push({
      pos,
      from: add(ball.pos, scale(dir, ball.radius * 0.35)),
      to: add(ball.pos, scale(dir, (w.orbitRadius || 40) + (w.length || 0) * 0.58)),
      radius: w.radius || Math.max(w.width || 8, w.length || 20) * 0.45,
      hitRadius: Math.max(8, (w.width || w.radius || 12) * 0.72),
      angle: a, length: w.length, width: w.width
    });
  }
  return points;
}

function weaponHitInfo(source, target, part, w) {
  if (w.type === "rotatingShield") {
    if (!isInShieldArc(source, target.pos, part.arc || w.shieldAngle || 160)) return { hit: false };
    const facing = norm(source.vel, source.lastDir);
    const shieldCenter = add(source.pos, scale(facing, (part.radius || 60) * 0.72));
    const distance = Math.abs(len(sub(target.pos, source.pos)) - (part.radius || 60) * 1.38);
    const withinArcBand = distance <= target.radius + Math.max(10, (part.width || 18) * 0.85);
    const nearFace = len(sub(target.pos, shieldCenter)) <= target.radius + (part.radius || 60) * 0.95;
    if (!withinArcBand && !nearFace) return { hit: false };
    const point = add(source.pos, scale(norm(sub(target.pos, source.pos), facing), (part.radius || 60) * 1.38));
    return { hit: true, point, normal: norm(sub(target.pos, point), facing), distance: Math.min(distance, len(sub(target.pos, shieldCenter))), weaponRadius: Math.max(12, (part.width || 18) * 0.8) };
  }
  if ((w.type === "fixedPart" || w.type === "dualFixed" || (w.type === "rotatingPart" && source.ballId === "B02_SWORD")) && part.from && part.to) {
    const closest = closestPointSegment(target.pos, part.from, part.to);
    const distance = len(sub(target.pos, closest));
    const weaponRadius = part.hitRadius || Math.max(8, (part.width || 12) * 0.7);
    return {
      hit: distance <= target.radius + weaponRadius,
      point: closest,
      normal: norm(sub(target.pos, closest), norm(sub(target.pos, source.pos), source.lastDir)),
      distance,
      weaponRadius
    };
  }
  const distance = len(sub(part.pos, target.pos));
  return {
    hit: distance <= target.radius + part.radius,
    point: part.pos,
    normal: norm(sub(target.pos, part.pos), norm(sub(target.pos, source.pos), source.lastDir)),
    distance,
    weaponRadius: part.radius
  };
}

function canHazardHit(h, b, time) {
  if (h.armedAt && time < h.armedAt) return false;
  if (h.ownerId === b.id && h.ownerImmunity) return false;
  if (h.ownerId === b.id && !h.ownerCanTrigger && time < (h.ownerGraceUntil || Infinity)) return false;
  if (h.teamId === "NEUTRAL") return h.ownerCanTrigger || h.ownerId !== b.id;
  return isEnemyTeam(h.teamId, b.teamId);
}

function isEnemyTeam(a, b) { return a !== b; }
function countOwned(list, ownerId) { return list.filter((item) => item.ownerId === ownerId).length; }
function activeStatusList(ball) {
  const statuses = [];
  if (ball.slowUntil > 0) statuses.push({ type: "slow", duration: ball.slowUntil });
  if (ball.statuses && ball.statuses.corrosion) statuses.push({ type: "corrosion", stacks: ball.statuses.corrosion.stacks, duration: ball.statuses.corrosion.duration });
  if (ball.statuses && ball.statuses.stun) statuses.push({ type: "stun", duration: ball.statuses.stun.duration });
  if (ball.statuses && ball.statuses.pin) statuses.push({ type: "pin", duration: ball.statuses.pin.duration });
  return statuses;
}
function weaponSourceType(w, ball) {
  if (w.type === "rotatingShield") return "shieldBash";
  if (w.type === "ring") return "sawRing";
  if (w.type === "fixedPart" && w.tipDamageMultiplier) return "drillTip";
  if (w.type === "fixedPart") return ball.ballId === "B05_LANCE" ? "lancePierce" : "fixedPart";
  if (w.type === "rotatingPart" && ball.ballId === "B06_CHAIN") return "flailHead";
  if (w.type === "rotatingPart" && ball.ballId === "B02_SWORD") return "swordSweep";
  return w.type;
}
function isTipHit(source, target, w) {
  const dir = norm(source.vel, source.lastDir);
  const tip = add(source.pos, scale(dir, w.offset || source.radius));
  return distPointSegment(target.pos, source.pos, tip) > source.radius * 0.7 && len(sub(target.pos, tip)) <= target.radius + Math.max(w.width || 12, source.radius * 0.24);
}
function sideOfLine(a, b, p) {
  const v = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return v >= 0 ? 1 : -1;
}
function topKey(obj) { const keys = Object.keys(obj); return keys.length ? keys.sort((a, b) => obj[b] - obj[a])[0] : "none"; }
function deg(v) { return v * Math.PI / 180; }
function copy(v) { return { x: v.x, y: v.y }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function scale(a, s) { return { x: a.x * s, y: a.y * s }; }
function dot(a, b) { return a.x * b.x + a.y * b.y; }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a, fallback) { const l = len(a); return l > 0.0001 ? scale(a, 1 / l) : copy(fallback || { x: 1, y: 0 }); }
function clampSpeed(v, max) { const l = len(v); return l > max ? scale(v, max / l) : v; }
function rotate(v, angle) { const c = Math.cos(angle), s = Math.sin(angle); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }
function distPointSegment(p, a, b) {
  return len(sub(p, closestPointSegment(p, a, b)));
}

function closestPointSegment(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(dot(ab, ab), 0.0001)));
  return add(a, scale(ab, t));
}

function keepCircleInsideArena(pos, radius, walls) {
  let p = copy(pos);
  for (let pass = 0; pass < 3; pass++) {
    for (const wall of walls) {
      const d = dot(p, wall.normal) - wall.c;
      if (d < radius) p = add(p, scale(wall.normal, radius - d + 1));
    }
  }
  return p;
}

function isInShieldArc(ball, point, angleDeg) {
  const facing = norm(ball.vel, ball.lastDir);
  const toPoint = norm(sub(point, ball.pos), facing);
  return dot(facing, toPoint) >= Math.cos(deg((angleDeg || 160) / 2));
}

module.exports = { Simulation, createDefaultMatch, buildWalls, weaponParts };
