(function () {
  const api = window.BallDuelReplay;
  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");
  const els = {
    ballA: document.getElementById("ballA"),
    ballB: document.getElementById("ballB"),
    map: document.getElementById("map"),
    seed: document.getElementById("seed"),
    speed: document.getElementById("speed"),
    sampleEvery: document.getElementById("sampleEvery"),
    spawnAX: document.getElementById("spawnAX"),
    spawnAY: document.getElementById("spawnAY"),
    angleA: document.getElementById("angleA"),
    spawnBX: document.getElementById("spawnBX"),
    spawnBY: document.getElementById("spawnBY"),
    angleB: document.getElementById("angleB"),
    soundEnabled: document.getElementById("soundEnabled"),
    restart: document.getElementById("restart"),
    pause: document.getElementById("pause"),
    step: document.getElementById("step"),
    exportLog: document.getElementById("exportLog"),
    copyConfig: document.getElementById("copyConfig"),
    randomSeed: document.getElementById("randomSeed"),
    status: document.getElementById("status"),
    cards: document.getElementById("cards"),
    log: document.getElementById("log")
  };

  let sim;
  let paused = false;
  let samples = [];
  let events = [];
  let lastFrame = 0;
  let audioCtx = null;
  let lastAudioWallTime = 0;

  function fillOptions() {
    for (const ball of api.BALLS) {
      els.ballA.appendChild(new Option(`${ball.id} ${ball.name}`, ball.id));
      els.ballB.appendChild(new Option(`${ball.id} ${ball.name}`, ball.id));
    }
    els.ballA.value = "B02_SWORD";
    els.ballB.value = "B14_SHIELD";
    for (const id of Object.keys(api.MAPS)) {
      els.map.appendChild(new Option(api.MAPS[id].name, id));
    }
    els.map.value = "SQUARE";
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeConfig() {
    return {
      mode: "ONE_VS_ONE",
      map: els.map.value,
      seed: Number(els.seed.value) || 1,
      slots: [
        {
          slotId: "A1",
          teamId: "A",
          ballId: els.ballA.value,
          spawn: { x: readNumber(els.spawnAX, -280), y: readNumber(els.spawnAY, -40) },
          initialAngleDeg: readNumber(els.angleA, 18)
        },
        {
          slotId: "B1",
          teamId: "B",
          ballId: els.ballB.value,
          spawn: { x: readNumber(els.spawnBX, 280), y: readNumber(els.spawnBY, 40) },
          initialAngleDeg: readNumber(els.angleB, 198)
        }
      ]
    };
  }

  function readNumber(el, fallback) {
    const value = Number(el && el.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function restart() {
    sim = new api.Simulation(makeConfig());
    paused = false;
    samples = [];
    events = [];
    lastFrame = 0;
    els.pause.textContent = "暂停";
    els.log.value = "";
    draw();
  }

  function tick(stepCount) {
    if (!sim || sim.result) return;
    const count = stepCount || Number(els.speed.value) || 1;
    for (let i = 0; i < count && !sim.result; i++) {
      sim.step();
      const drained = sim.drainEvents();
      if (drained.length) {
        events.push(...drained);
        playAudioEvents(drained);
      }
      const sampleEvery = Math.max(1, Number(els.sampleEvery.value) || 12);
      if (sim.tick % sampleEvery === 0) samples.push({ tick: sim.tick, time: sim.time, snapshot: sim.snapshot(), events: drained });
    }
  }

  function draw() {
    if (!sim) return;
    const rect = canvas.getBoundingClientRect();
    api.drawArena(ctx, sim.snapshot(), rect.width, rect.height, sim.config.map, {});
    updateUi();
  }

  function updateUi() {
    const snap = sim.snapshot();
    els.status.textContent = `${sim.config.map} · t=${snap.time.toFixed(2)}s · tick=${sim.tick} · samples=${samples.length}${sim.result ? " · 已结束" : ""}`;
    document.documentElement.dataset.replayStatus = els.status.textContent;
    document.documentElement.dataset.replayEvents = String(events.length);
    document.documentElement.dataset.replaySamples = String(samples.length);
    els.cards.innerHTML = snap.balls.map((b) => {
      const hp = Math.max(0, Math.round(b.hp / b.maxHp * 100));
      const status = (b.statuses || []).map((s) => s.type + (s.stacks ? `x${s.stacks}` : "")).join(" / ");
      return `<div class="card"><b>${b.slotId} ${b.name}</b><div class="stat">${b.ballId} ${status}</div><div class="hp"><i style="width:${hp}%"></i></div></div>`;
    }).join("");
    const recent = events.slice(-10).map((e) => `${e.time.toFixed(2)} ${e.type} ${e.sourceId || ""}->${e.targetId || ""} ${e.sourceType || e.eventName || ""} ${e.amount ? Math.round(e.amount) : ""}`);
    els.log.value = recent.join("\n");
  }

  function ensureAudio() {
    if (!els.soundEnabled || !els.soundEnabled.checked) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioCtx) audioCtx = new AudioCtor();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playAudioEvents(drained) {
    if (!els.soundEnabled || !els.soundEnabled.checked || !drained.length) return;
    const audioEvents = drained.filter((e) => e.type === "audio");
    if (!audioEvents.length) return;
    const nowWall = performance.now();
    if (nowWall - lastAudioWallTime < 18) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    lastAudioWallTime = nowWall;
    audioEvents.slice(-3).forEach((event, index) => playCue(ctx, event, index * 0.025));
  }

  function playCue(ctx, event, delay) {
    const kind = event.kind || "hit";
    const base = kind === "wall" || kind === "weaponWall" ? 130
      : kind === "ricochet" || kind === "reflect" || kind === "block" ? 520
      : kind === "warning" ? 360
      : kind === "eliminate" ? 720
      : 240 + (hashText(event.eventName || "") % 180);
    const duration = kind === "warning" ? 0.16 : kind === "eliminate" ? 0.22 : 0.08;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "wall" ? "triangle" : kind === "ricochet" ? "square" : "sine";
    osc.frequency.setValueAtTime(base, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, base * (kind === "eliminate" ? 0.45 : 1.45)), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(kind === "warning" ? 0.175 : 0.35, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash;
  }

  function loop(ts) {
    if (!lastFrame) lastFrame = ts;
    if (!paused && ts - lastFrame >= 16) {
      tick();
      draw();
      lastFrame = ts;
    }
    requestAnimationFrame(loop);
  }

  function exportRecord() {
    const record = getRecord();
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ball-duel-${record.config.seed}-${els.ballA.value}-vs-${els.ballB.value}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyConfig() {
    const text = JSON.stringify(makeConfig(), null, 2);
    await navigator.clipboard.writeText(text);
  }

  function getRecord() {
    return {
      config: makeConfig(),
      result: sim && sim.result,
      current: sim && sim.snapshot(),
      samples,
      events
    };
  }

  fillOptions();
  resize();
  restart();
  requestAnimationFrame(loop);

  window.__BallDuelReplayViewer = {
    getRecord,
    getStatus: () => ({
      paused,
      tick: sim && sim.tick,
      time: sim && sim.time,
      result: sim && sim.result,
      samples: samples.length,
      events: events.length
    }),
    pause: () => { paused = true; updateUi(); },
    resume: () => { paused = false; updateUi(); },
    step: (count = 1) => { paused = true; tick(count); draw(); }
  };

  window.addEventListener("resize", () => { resize(); draw(); });
  els.restart.onclick = () => { ensureAudio(); restart(); };
  els.pause.onclick = () => {
    ensureAudio();
    paused = !paused;
    els.pause.textContent = paused ? "继续" : "暂停";
  };
  els.step.onclick = () => { ensureAudio(); paused = true; tick(1); draw(); els.pause.textContent = "继续"; };
  els.exportLog.onclick = exportRecord;
  els.copyConfig.onclick = copyConfig;
  els.randomSeed.onclick = () => {
    els.seed.value = Math.floor(Math.random() * 1000000000);
    restart();
  };
  if (els.soundEnabled) els.soundEnabled.addEventListener("change", ensureAudio);
  [els.ballA, els.ballB, els.map, els.seed, els.spawnAX, els.spawnAY, els.angleA, els.spawnBX, els.spawnBY, els.angleB].forEach((el) => el.addEventListener("change", restart));
}());
