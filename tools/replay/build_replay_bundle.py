from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "replay_bundle.js"

MODULES = [
    ("./rng", "miniprogram/core/rng.js"),
    ("./configs_v2", "miniprogram/core/configs_v2.js"),
    ("./simulation_v2", "miniprogram/core/simulation_v2.js"),
    ("./arena_renderer", "miniprogram/core/arena_renderer.js"),
]


def js_string(value):
    return value.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


parts = [
    "(function () {",
    "  const modules = {};",
    "  const cache = {};",
    "  function define(id, factory) { modules[id] = factory; }",
    "  function localRequire(id) {",
    "    if (!modules[id]) throw new Error('Replay bundle missing module: ' + id);",
    "    if (!cache[id]) {",
    "      const module = { exports: {} };",
    "      cache[id] = module;",
    "      modules[id](localRequire, module, module.exports);",
    "    }",
    "    return cache[id].exports;",
    "  }",
]

for module_id, rel_path in MODULES:
    code = (ROOT / rel_path).read_text(encoding="utf-8")
    parts.append(f"  define('{module_id}', function (require, module, exports) {{\n{code}\n  }});")

parts.extend([
    "  const sim = localRequire('./simulation_v2');",
    "  const cfg = localRequire('./configs_v2');",
    "  const renderer = localRequire('./arena_renderer');",
    "  window.BallDuelReplay = {",
    "    Simulation: sim.Simulation,",
    "    createDefaultMatch: sim.createDefaultMatch,",
    "    buildWalls: sim.buildWalls,",
    "    weaponParts: sim.weaponParts,",
    "    MAPS: cfg.MAPS,",
    "    MODES: cfg.MODES,",
    "    BALLS: cfg.BALLS,",
    "    BALL_BY_ID: cfg.BALL_BY_ID,",
    "    drawArena: renderer.drawArena",
    "  };",
    "}());",
])

OUT.write_text("\n".join(parts), encoding="utf-8")
print(f"wrote {OUT}")
