const DEFAULT_VOLUME = 0.85;

const SFX_PROFILES = {
  SFX_B01_SPIKE_STAB_HIT: {
    name: "dry spike stab",
    minInterval: 0.13,
    layers: [
      tone("triangle", 920, 0.58, 0.075, 0.22),
      tone("sine", 190, 0.72, 0.09, 0.14),
      click(2600, 0.018, 0.12)
    ]
  },
  SFX_B02_GREAT_SWORD_HIT: {
    name: "metal sword slash",
    minInterval: 0.12,
    layers: [
      tone("sawtooth", 360, 1.75, 0.15, 0.16),
      tone("triangle", 980, 1.18, 0.09, 0.12),
      noise(0.075, 0.08, "highpass", 1200)
    ]
  },
  SFX_B03_LONG_ARROW_HIT: {
    name: "bow twang arrow pierce",
    minInterval: 0.11,
    layers: [
      tone("triangle", 250, 1.55, 0.12, 0.16),
      tone("sine", 1480, 0.82, 0.07, 0.1),
      click(2100, 0.018, 0.08)
    ]
  },
  SFX_B04_TOXIC_THREAD_HIT: {
    name: "toxic wire slice",
    minInterval: 0.18,
    layers: [
      tone("sawtooth", 520, 0.62, 0.13, 0.11),
      noise(0.14, 0.1, "bandpass", 920),
      tone("sine", 760, 0.78, 0.08, 0.08)
    ]
  },
  SFX_B05_LONG_LANCE_PIERCE_HIT: {
    name: "lance piercing thrust",
    minInterval: 0.11,
    layers: [
      tone("triangle", 840, 0.45, 0.11, 0.17),
      tone("sine", 150, 0.7, 0.12, 0.12),
      click(3100, 0.015, 0.1)
    ]
  },
  SFX_B06_HEAVY_HAMMER_HIT: {
    name: "chain hammer impact",
    minInterval: 0.18,
    layers: [
      tone("triangle", 120, 0.48, 0.2, 0.24),
      noise(0.16, 0.18, "lowpass", 850),
      tone("square", 520, 0.64, 0.1, 0.08)
    ]
  },
  SFX_B07_SAW_RING_GRIND_HIT: {
    name: "abrasive saw grind",
    minInterval: 0.12,
    globalInterval: 0.055,
    layers: [
      tone("square", 340, 0.68, 0.11, 0.13),
      tone("sawtooth", 690, 0.72, 0.1, 0.09),
      noise(0.12, 0.09, "bandpass", 1650)
    ]
  },
  SFX_B08_INFERNO_TRAIL_HIT: {
    name: "inferno fire burst",
    minInterval: 0.2,
    globalInterval: 0.12,
    layers: [
      noise(0.22, 0.16, "lowpass", 700),
      tone("sine", 150, 0.5, 0.16, 0.13),
      tone("triangle", 330, 0.82, 0.09, 0.07)
    ]
  },
  SFX_B09_ICE_SPEAR_HIT: {
    name: "icy spear crack",
    minInterval: 0.12,
    layers: [
      tone("sine", 1320, 1.28, 0.13, 0.14),
      tone("triangle", 760, 0.52, 0.12, 0.1),
      noise(0.07, 0.08, "highpass", 2300)
    ]
  },
  SFX_B10_LIGHTNING_ZAP_HIT: {
    name: "electric arc zap",
    minInterval: 0.12,
    layers: [
      tone("square", 620, 2.1, 0.085, 0.15),
      tone("square", 1320, 0.58, 0.045, 0.08),
      noise(0.055, 0.07, "highpass", 1800)
    ]
  },
  SFX_B11_MINI_CANNON_BLAST_HIT: {
    name: "mini cannon blast",
    minInterval: 0.2,
    layers: [
      tone("sawtooth", 120, 0.38, 0.24, 0.24),
      noise(0.18, 0.17, "lowpass", 620),
      click(1200, 0.02, 0.07)
    ]
  },
  SFX_B12_RICOCHET_BLADE_HIT: {
    name: "ricochet blade ping",
    minInterval: 0.1,
    layers: [
      tone("triangle", 1180, 1.7, 0.1, 0.13),
      tone("sine", 1880, 0.76, 0.075, 0.1),
      click(3300, 0.015, 0.08)
    ]
  },
  SFX_B13_ARMED_MINE_HIT: {
    name: "armed mine thump",
    minInterval: 0.24,
    layers: [
      tone("sine", 92, 0.42, 0.28, 0.26),
      noise(0.2, 0.16, "lowpass", 520),
      tone("triangle", 260, 0.64, 0.12, 0.08)
    ]
  },
  SFX_B14_SHIELD_BLADE_HIT: {
    name: "shield block edge",
    minInterval: 0.14,
    layers: [
      tone("triangle", 720, 1.28, 0.14, 0.16),
      tone("sine", 190, 0.55, 0.1, 0.12),
      click(1900, 0.022, 0.1)
    ]
  },
  SFX_B15_POWER_DRILL_HIT: {
    name: "power drill burr",
    minInterval: 0.1,
    globalInterval: 0.06,
    layers: [
      tone("sawtooth", 720, 1.04, 0.16, 0.11),
      tone("square", 1080, 0.95, 0.11, 0.06),
      noise(0.12, 0.07, "bandpass", 2100)
    ]
  },
  SFX_B16_CRESCENT_BOOMERANG_HIT: {
    name: "crescent boomerang whoosh",
    minInterval: 0.12,
    layers: [
      tone("triangle", 430, 1.55, 0.17, 0.13),
      noise(0.13, 0.08, "bandpass", 760),
      tone("sine", 960, 0.72, 0.08, 0.08)
    ]
  },
  SFX_B17_FOCUSED_LASER_HIT: {
    name: "focused laser hit",
    minInterval: 0.18,
    layers: [
      tone("square", 980, 1.8, 0.12, 0.15),
      tone("sine", 2400, 0.82, 0.08, 0.08),
      noise(0.06, 0.05, "highpass", 2600)
    ]
  },
  SFX_B18_VENOM_CORRODE_HIT: {
    name: "venom bubble corrode",
    minInterval: 0.24,
    globalInterval: 0.14,
    layers: [
      tone("sawtooth", 300, 0.55, 0.18, 0.12),
      noise(0.16, 0.1, "bandpass", 420),
      tone("sine", 150, 0.86, 0.12, 0.08)
    ]
  },
  SFX_B19_ORBIT_STAR_HIT: {
    name: "orbit star chime",
    minInterval: 0.12,
    layers: [
      tone("sine", 1360, 1.32, 0.12, 0.12),
      tone("triangle", 2040, 0.68, 0.08, 0.08),
      click(2800, 0.014, 0.08)
    ]
  },
  SFX_B20_SHRAPNEL_CHIP_HIT: {
    name: "shrapnel chips",
    minInterval: 0.16,
    globalInterval: 0.09,
    layers: [
      click(2100, 0.018, 0.08),
      click(2800, 0.026, 0.065, 0.018),
      noise(0.075, 0.07, "highpass", 1700)
    ]
  },
  SFX_B21_HARPOON_TETHER_HIT: {
    name: "harpoon tether snap",
    minInterval: 0.14,
    layers: [
      tone("triangle", 700, 0.48, 0.1, 0.14),
      tone("sine", 180, 1.8, 0.18, 0.12),
      click(2400, 0.02, 0.09)
    ]
  },
  SFX_B22_PRISM_SLICE_HIT: {
    name: "prism glass slice",
    minInterval: 0.14,
    layers: [
      tone("sine", 1580, 1.46, 0.16, 0.13),
      tone("triangle", 2320, 0.7, 0.11, 0.08),
      noise(0.06, 0.045, "highpass", 3200)
    ]
  },
  SFX_B23_FORCE_PULSE_HIT: {
    name: "force pulse thump",
    minInterval: 0.22,
    layers: [
      tone("sine", 150, 1.85, 0.24, 0.2),
      noise(0.18, 0.09, "lowpass", 780),
      tone("triangle", 360, 0.72, 0.16, 0.08)
    ]
  },
  SFX_B24_TWIN_ANCHOR_CUT_HIT: {
    name: "twin anchor chop",
    minInterval: 0.15,
    layers: [
      tone("triangle", 260, 0.58, 0.16, 0.17),
      tone("sawtooth", 620, 0.74, 0.11, 0.09),
      click(1700, 0.02, 0.08)
    ]
  },
  SFX_BALL_WALL_IMPACT: {
    name: "subtle wall tok",
    minInterval: 0.08,
    globalInterval: 0.025,
    layers: [
      tone("triangle", 250, 0.68, 0.07, 0.045),
      click(900, 0.012, 0.022)
    ]
  },
  SFX_PROJECTILE_RICOCHET: {
    name: "light projectile ricochet",
    minInterval: 0.08,
    globalInterval: 0.035,
    layers: [
      tone("triangle", 1540, 1.34, 0.075, 0.08),
      click(2600, 0.012, 0.05)
    ]
  },
  SFX_LASER_CHARGE: {
    name: "laser warning charge",
    minInterval: 0.28,
    layers: [
      tone("sine", 420, 2.4, 0.22, 0.1),
      tone("triangle", 900, 1.35, 0.18, 0.045)
    ]
  },
  SFX_ELIMINATION_POP: {
    name: "elimination pop",
    minInterval: 0.18,
    layers: [
      tone("triangle", 520, 0.38, 0.16, 0.14),
      noise(0.09, 0.07, "lowpass", 1200)
    ]
  },
  SFX_HIT_HIGH: {
    name: "presentation high damage impact",
    minInterval: 0.12,
    globalInterval: 0.08,
    layers: [
      tone("triangle", 180, 0.55, 0.16, 0.18),
      tone("sawtooth", 620, 0.72, 0.1, 0.1),
      noise(0.09, 0.08, "bandpass", 1200)
    ]
  },
  SFX_HIT_HEAVY: {
    name: "presentation heavy hit slam",
    minInterval: 0.18,
    globalInterval: 0.12,
    layers: [
      tone("sine", 82, 0.42, 0.24, 0.28),
      tone("triangle", 240, 0.58, 0.18, 0.16),
      noise(0.18, 0.13, "lowpass", 760),
      click(1800, 0.016, 0.08)
    ]
  },
  SFX_COMBO_UP: {
    name: "combo tier rise",
    minInterval: 0.18,
    globalInterval: 0.12,
    layers: [
      tone("triangle", 680, 1.32, 0.12, 0.08),
      tone("sine", 1040, 1.22, 0.1, 0.06, 0.025)
    ]
  },
  DEFAULT: {
    name: "fallback tap",
    minInterval: 0.1,
    layers: [
      tone("triangle", 520, 0.75, 0.11, 0.12)
    ]
  }
};

class AudioManager {
  constructor() {
    this.enabled = true;
    this.volume = DEFAULT_VOLUME;
    this.last = {};
    this.globalLast = {};
    try {
      this.ctx = typeof wx !== "undefined" && wx.createWebAudioContext
        ? wx.createWebAudioContext()
        : typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)
          ? new (window.AudioContext || window.webkitAudioContext)()
          : null;
    } catch (err) {
      this.ctx = null;
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  setVolume(volume) {
    const value = Number(volume);
    this.volume = Number.isFinite(value) ? Math.max(0, Math.min(1.5, value)) : DEFAULT_VOLUME;
  }

  destroy() {
    this.enabled = false;
    this.last = {};
    this.globalLast = {};
    try {
      if (this.ctx && this.ctx.close) this.ctx.close();
    } catch (err) {}
    this.ctx = null;
  }

  play(eventName, point, meta) {
    if (!this.enabled || !this.ctx || !eventName) return;
    const profile = profileFor(eventName);
    const now = this.ctx.currentTime || 0;
    const sourceKey = meta && meta.sourceId ? `${eventName}_${meta.sourceId}` : eventName;
    const minInterval = typeof profile.minInterval === "number" ? profile.minInterval : 0.1;
    if ((this.last[sourceKey] || -999) + minInterval > now) return;
    if (profile.globalInterval && (this.globalLast[eventName] || -999) + profile.globalInterval > now) return;
    this.last[sourceKey] = now;
    this.globalLast[eventName] = now;
    try {
      const panValue = Math.max(-0.35, Math.min(0.35, ((point && point.x) || 0) / 900));
      for (const layer of profile.layers || []) this.playLayer(layer, now, panValue);
    } catch (err) {
      this.enabled = false;
    }
  }

  playLayer(layer, now, panValue) {
    if (layer.kind === "noise") return this.playNoise(layer, now, panValue);
    return this.playTone(layer, now, panValue);
  }

  playTone(layer, now, panValue) {
    if (!this.ctx.createOscillator || !this.ctx.createGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const start = now + (layer.delay || 0);
    const duration = layer.duration || 0.1;
    const pitch = randomRange(0.96, 1.04);
    const volume = (layer.volume || 0.1) * randomRange(0.88, 1.08) * this.volume;
    osc.type = layer.type || "triangle";
    setParam(osc.frequency, Math.max(20, (layer.freq || 440) * pitch), start);
    rampParam(osc.frequency, Math.max(20, (layer.freq || 440) * (layer.endRatio || 1) * pitch), start + duration);
    this.applyEnvelope(gain.gain, start, duration, volume, layer.attack);
    this.connectToOutput(osc, gain, panValue, layer.filter);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  playNoise(layer, now, panValue) {
    if (!this.ctx.createBuffer || !this.ctx.createBufferSource || !this.ctx.createGain) return;
    const start = now + (layer.delay || 0);
    const duration = layer.duration || 0.1;
    const sampleRate = this.ctx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    let value = 0;
    for (let i = 0; i < frameCount; i++) {
      value = value * 0.58 + (Math.random() * 2 - 1) * 0.42;
      data[i] = value;
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    const volume = (layer.volume || 0.08) * randomRange(0.86, 1.06) * this.volume;
    this.applyEnvelope(gain.gain, start, duration, volume, layer.attack);
    this.connectToOutput(source, gain, panValue, layer.filter);
    source.start(start);
    try { source.stop(start + duration + 0.03); } catch (err) {}
  }

  applyEnvelope(param, start, duration, volume, attack) {
    const attackTime = Math.max(0.003, attack || Math.min(0.012, duration * 0.22));
    setParam(param, 0.0001, start);
    linearRamp(param, volume, start + attackTime);
    rampParam(param, 0.0001, start + duration);
  }

  connectToOutput(source, gain, panValue, filterSpec) {
    let node = gain;
    if (filterSpec && this.ctx.createBiquadFilter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterSpec.type || "lowpass";
      setParam(filter.frequency, filterSpec.freq || 1200, this.ctx.currentTime || 0);
      gain.connect(filter);
      node = filter;
    }
    if (this.ctx.createStereoPanner) {
      const pan = this.ctx.createStereoPanner();
      setParam(pan.pan, panValue || 0, this.ctx.currentTime || 0);
      node.connect(pan);
      pan.connect(this.ctx.destination);
    } else {
      node.connect(this.ctx.destination);
    }
    source.connect(gain);
  }
}

function tone(type, freq, endRatio, duration, volume, delay) {
  return { kind: "tone", type, freq, endRatio, duration, volume, delay: delay || 0 };
}

function noise(duration, volume, filterType, filterFreq, delay) {
  return { kind: "noise", duration, volume, delay: delay || 0, filter: { type: filterType, freq: filterFreq } };
}

function click(freq, duration, volume, delay) {
  return tone("square", freq, 0.72, duration, volume, delay || 0);
}

function profileFor(eventName) {
  return SFX_PROFILES[eventName] || categoryFallback(eventName) || SFX_PROFILES.DEFAULT;
}

function categoryFallback(eventName) {
  const name = String(eventName || "");
  if (name.indexOf("WALL") >= 0) return SFX_PROFILES.SFX_BALL_WALL_IMPACT;
  if (name.indexOf("RICOCHET") >= 0) return SFX_PROFILES.SFX_PROJECTILE_RICOCHET;
  if (name.indexOf("LASER") >= 0) return SFX_PROFILES.SFX_B17_FOCUSED_LASER_HIT;
  if (name.indexOf("LIGHTNING") >= 0 || name.indexOf("ARC") >= 0) return SFX_PROFILES.SFX_B10_LIGHTNING_ZAP_HIT;
  if (name.indexOf("CANNON") >= 0 || name.indexOf("MINE") >= 0 || name.indexOf("BLAST") >= 0) return SFX_PROFILES.SFX_B11_MINI_CANNON_BLAST_HIT;
  if (name.indexOf("VENOM") >= 0 || name.indexOf("TOXIC") >= 0) return SFX_PROFILES.SFX_B18_VENOM_CORRODE_HIT;
  return null;
}

function setParam(param, value, time) {
  if (!param) return;
  if (param.setValueAtTime) param.setValueAtTime(value, time);
  else param.value = value;
}

function linearRamp(param, value, time) {
  if (!param) return;
  if (param.linearRampToValueAtTime) param.linearRampToValueAtTime(value, time);
  else setParam(param, value, time);
}

function rampParam(param, value, time) {
  if (!param) return;
  if (param.exponentialRampToValueAtTime && value > 0) param.exponentialRampToValueAtTime(value, time);
  else linearRamp(param, value, time);
}

function randomRange(min, max) {
  return min + (max - min) * Math.random();
}

module.exports = { AudioManager, SFX_PROFILES, profileFor };
