"""Writes design/tokens.css from glossary.json (never edit tokens.css by hand)."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(ROOT, "glossary.json"), encoding="utf-8"))
C = G["colours"]
L = ["/* GENERATED from glossary.json by build/tokens.py. Do not edit. */", ":root {"]
for k in ("page", "card", "border", "ink", "muted", "sunk"):
    L.append(f"  --af-{k}: {C[k]};")
for k, v in C["layers"].items():
    L.append(f"  --af-layer-{k.lower()}: {v};")
for k, v in C["rings"].items():
    if not k.startswith("_"):
        L.append(f"  --af-ring-{k}: {v};")
for k, v in C["status"].items():
    if not k.startswith("_"):
        L.append(f"  --af-status-{k.replace('_', '-')}: {v};")
pa = C["palette_a"]
for k in ("paper", "cream", "ink", "muted", "line"):
    L.append(f"  --pa-{k}: {pa[k]};")
for n, s in pa["slots"].items():
    L.append(f"  --pa-{n}: {s['fill']}; --pa-{n}-text: {s['text']}; --pa-{n}-tint: {s['tint']};")
sp = G["space"]
for i, v in enumerate(sp["scale"]):
    L.append(f"  --af-space-{i + 1}: {v}px;")
L.append(f"  --af-radius: {sp['radius'] // sp['factor']}px; --af-radius-small: {sp['radius_small'] // sp['factor']}px; --af-band: {sp['band'] // sp['factor']}px;")
L.append(f"  --af-font: {G['type']['family']}, system-ui, sans-serif;")
L.append("}")
os.makedirs(os.path.join(ROOT, "design"), exist_ok=True)
open(os.path.join(ROOT, "design", "tokens.css"), "w").write("\n".join(L) + "\n")
print("design/tokens.css")
