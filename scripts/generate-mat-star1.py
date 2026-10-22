#!/usr/bin/env python3
"""
Generate the question bank for Mental Ability STAR 1 ("mat-star-01"):
exam-style black-and-white figures — odd-one-out + figure-matching.

Stdlib only, fixed seed -> deterministic output.

Usage:
    python scripts/generate-mat-star1.py
"""

import hashlib
import json
import random
from collections import Counter
from copy import deepcopy

SEED = 20261022
OUT = "src/content/mental-ability/star-01.json"
GALAXY = "mental-ability"
STAR_ID = "mat-star-01"
STAR_INDEX = 1

# --- Figure domain -----------------------------------------------------------

FRAMES = ["circle", "square", "triangle", "diamond", "hexagon", "none"]
REAL_FRAMES = FRAMES[:5]
SHADES = ["none", "solid", "left", "right", "top", "bottom", "stripes"]
HALF_SHADES = ["left", "right", "top", "bottom"]
OPPOSITE = {"left": "right", "right": "left", "top": "bottom", "bottom": "top"}
KINDS = ["dot", "ring", "square", "triangle", "cross", "bar-h", "bar-v"]
LINES = ["none", "horizontal", "vertical", "diag-down", "diag-up", "cross"]
REAL_LINES = LINES[1:]
ROTS = [0, 90, 180, 270]

ALLOWED_CELLS = {
    "circle": list(range(9)),
    "square": list(range(9)),
    "hexagon": list(range(9)),
    "triangle": [1, 4, 6, 7, 8],
    "diamond": [1, 3, 4, 5, 7],
    "none": list(range(9)),
}

CONTENT_PROPS = ["frame", "gap", "shade", "lines", "marks"]
RULE_PROP = {
    "fill": "shade",
    "frame-shape": "frame",
    "mark-count": "marks",
    "gap": "gap",
    "mark-kind": "marks",
    "mark-position": "marks",
    "half-shading": "shade",
    "lines": "lines",
    "mirror": "transform",
}
D1_RULES = ["fill", "frame-shape", "mark-count", "gap"]
D2_RULES = ["mark-kind", "mark-position", "half-shading", "lines"]

# --- Child-facing text (en); add more locales by adding dicts ------------------

TEXT = {
    "en": {
        "odd": {"prompt": "Which figure is the odd one out?"},
        "match": {
            "prompt": "Which figure is exactly like the given figure?",
            "expl": "Check every mark. Only this figure has everything in the same place.",
        },
    }
}

SHADE_PHRASE = {
    "none": "plain",
    "solid": "filled in",
    "stripes": "striped",
    "left": "shaded on the left",
    "right": "shaded on the right",
    "top": "shaded at the top",
    "bottom": "shaded at the bottom",
}
LINE_PHRASE = {
    "horizontal": "a horizontal line",
    "vertical": "a vertical line",
    "diag-down": "a line slanting down",
    "diag-up": "a line slanting up",
    "cross": "crossed lines",
}
KIND_WORD = {
    "dot": "dot",
    "ring": "ring",
    "square": "square",
    "triangle": "triangle",
    "cross": "cross",
    "bar-h": "bar",
    "bar-v": "bar",
}

# --- Transforms (must mirror src/lib/content/figureMath.ts) -------------------


def pos(cell):
    return divmod(cell, 3)


def cell_of(r, c):
    return r * 3 + c


def rot_cell(cell, rot):
    r, c = pos(cell)
    if rot == 90:
        return cell_of(c, 2 - r)
    if rot == 180:
        return cell_of(2 - r, 2 - c)
    if rot == 270:
        return cell_of(2 - c, r)
    return cell


def mir_cell(cell):
    r, c = pos(cell)
    return cell_of(r, 2 - c)


ROT90_LINE = {
    "none": "none",
    "horizontal": "vertical",
    "vertical": "horizontal",
    "diag-down": "diag-up",
    "diag-up": "diag-down",
    "cross": "cross",
}
MIR_LINE = {
    "none": "none",
    "horizontal": "horizontal",
    "vertical": "vertical",
    "diag-down": "diag-up",
    "diag-up": "diag-down",
    "cross": "cross",
}
ROT90_SHADE = {
    "none": "none",
    "solid": "solid",
    "stripes": "stripes",
    "left": "top",
    "top": "right",
    "right": "bottom",
    "bottom": "left",
}
MIR_SHADE = {
    "none": "none",
    "solid": "solid",
    "stripes": "stripes",
    "left": "right",
    "right": "left",
    "top": "top",
    "bottom": "bottom",
}


def rot_line(l, rot):
    for _ in range(rot // 90):
        l = ROT90_LINE[l]
    return l


def rot_shade(s, rot):
    for _ in range(rot // 90):
        s = ROT90_SHADE[s]
    return s


def transform(spec, rot, mir):
    """Apply mirror then rotation to the geometry; flags reset to identity."""
    marks = [dict(m) for m in spec["marks"]]
    lines = spec["lines"]
    shade = spec["shade"]
    if mir:
        marks = [{**m, "cell": mir_cell(m["cell"])} for m in marks]
        lines = MIR_LINE[lines]
        shade = MIR_SHADE[shade]
    if rot:
        marks = [{**m, "cell": rot_cell(m["cell"], rot)} for m in marks]
        lines = rot_line(lines, rot)
        shade = rot_shade(shade, rot)
    return {**spec, "marks": marks, "lines": lines, "shade": shade, "rotation": 0, "mirror": False}


def effective(spec):
    return transform(spec, spec["rotation"], spec["mirror"])


def normalize(spec):
    """Marks sorted so equal sets compare equal."""
    s = dict(spec)
    s["marks"] = sorted(
        s["marks"], key=lambda m: (m["cell"], m["kind"], m["filled"])
    )
    return s


def key_of(spec):
    marks = ",".join(
        f"{m['cell']}:{m['kind']}:{int(m['filled'])}" for m in spec["marks"]
    )
    return "|".join(
        [
            spec["frame"],
            str(int(spec["gap"])),
            spec["shade"],
            marks,
            spec["lines"],
            str(spec["rotation"]),
            str(int(spec["mirror"])),
        ]
    )


def exact_equal(a, b):
    return key_of(effective(a)) == key_of(effective(b))


def canonical_obj(spec):
    e = effective(spec)
    best, bk = e, key_of(e)
    for r in ROTS:
        for m in (False, True):
            t = transform(e, r, m)
            k = key_of(t)
            if k < bk:
                bk, best = k, t
    return best


def canonical(spec):
    return key_of(canonical_obj(spec))


def rotation_class(spec):
    e = effective(spec)
    best = key_of(e)
    for r in ROTS:
        k = key_of(transform(e, r, False))
        if k < best:
            best = k
    return best


def content_props(spec):
    """The visual properties as the child sees them (orientation baked in, but
    NOT canonicalized — left and right shading are real differences)."""
    e = effective(spec)
    marks = ",".join(
        sorted(f"{m['cell']}:{m['kind']}:{int(m['filled'])}" for m in e["marks"])
    )
    return {
        "frame": e["frame"],
        "gap": str(e["gap"]),
        "shade": e["shade"],
        "lines": e["lines"],
        "marks": marks,
    }


def odd_index(values):
    """Index of the single figure differing from three equal ones (-1 if not 3-1)."""
    c = Counter(values)
    if len(c) != 2 or 3 not in c.values():
        return -1
    v = next(k for k, n in c.items() if n == 1)
    return values.index(v)


def valid_odd(figures, rule, ci):
    props = [content_props(f) for f in figures]
    splitters = set()
    for p in CONTENT_PROPS:
        idx = odd_index([x[p] for x in props])
        if idx >= 0:
            splitters.add(p)
            if idx != ci:
                return False
    want = RULE_PROP[rule]
    if want == "transform":
        t = odd_index([rotation_class(f) for f in figures])
        return t == ci and not splitters
    return splitters == {want}


def mirror_is_asymmetric(spec):
    """Mirror image is not equal to any rotation of the figure."""
    e = effective(spec)
    rots = {key_of(transform(e, r, False)) for r in ROTS}
    return key_of(transform(e, 0, True)) not in rots


def distinct_rotations(spec):
    e = effective(spec)
    return len({key_of(transform(e, r, False)) for r in ROTS})


# --- Mark helpers --------------------------------------------------------------


def mark_set(cells, kinds, filleds):
    return [
        {"cell": c, "kind": k, "filled": f}
        for c, k, f in zip(cells, kinds, filleds)
    ]


def random_marks(rng, frames, n=None):
    """n marks at distinct cells valid in ALL given frames."""
    cells = list(ALLOWED_CELLS[frames[0]])
    for f in frames[1:]:
        cells = [c for c in cells if c in ALLOWED_CELLS[f]]
    if not cells:
        return None
    n = n if n is not None else rng.randint(1, 4)
    n = min(n, len(cells))
    chosen = rng.sample(cells, n)
    return mark_set(
        chosen,
        [rng.choice(KINDS) for _ in chosen],
        [rng.random() < 0.5 for _ in chosen],
    )


def neighbours(cell):
    r, c = pos(cell)
    out = []
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            nr, nc = r + dr, c + dc
            if 0 <= nr < 3 and 0 <= nc < 3:
                out.append(cell_of(nr, nc))
    return out


# --- Odd-one-out ---------------------------------------------------------------


def noise_groups(rng, _unused=0):
    """Partition of the 4 positions into groups of sizes like [2,2] or [2,1,1]."""
    split = rng.choice([[2, 2], [2, 1, 1]])
    idx = list(range(4))
    rng.shuffle(idx)
    groups, at = [], 0
    for size in split:
        groups.append(idx[at : at + size])
        at += size
    return groups


def gen_odd(rng, rule, noise_n, ci):
    props = [p for p in CONTENT_PROPS if p != RULE_PROP[rule]]
    noises = rng.sample(props, noise_n)

    # --- frame values (rule first, then frame noise) so marks can be
    # generated inside the intersection of every frame used. --------------------
    if rule == "frame-shape":
        f_common, f_odd = rng.sample(REAL_FRAMES, 2)
        frame_vals = [f_common] * 4
        frame_vals[ci] = f_odd
    elif rule == "mirror":
        frame_vals = [rng.choice(["circle", "square", "hexagon"])] * 4
    else:
        frame_vals = [rng.choice(REAL_FRAMES)] * 4

    frame_noise_groups = []
    if "frame" in noises:
        noises.remove("frame")
        frame_noise_groups = noise_groups(rng)
        pool = [f for f in REAL_FRAMES if f not in frame_vals]
        if len(pool) < len(frame_noise_groups):
            return None
        vals = rng.sample(pool, len(frame_noise_groups))
        for g, v in zip(frame_noise_groups, vals):
            for i in g:
                frame_vals[i] = v

    all_frames = list(dict.fromkeys(frame_vals))

    # --- shared values ----------------------------------------------------------
    shared = {
        "gap": rng.random() < 0.3,
        "shade": rng.choice(SHADES),
        "lines": rng.choice(LINES),
        "marks": random_marks(rng, all_frames),
    }
    if shared["marks"] is None:
        return None

    gap_vals = [shared["gap"]] * 4
    shade_vals = [shared["shade"]] * 4
    line_vals = [shared["lines"]] * 4
    mark_vals = [deepcopy(shared["marks"]) for _ in range(4)]

    # --- rule values -------------------------------------------------------------
    if rule == "fill":
        common = rng.choice([s for s in SHADES if s != "none"])
        odd = rng.choice([s for s in SHADES if s != common])
        shade_vals = [common] * 4
        shade_vals[ci] = odd
    elif rule == "half-shading":
        common = rng.choice(HALF_SHADES)
        shade_vals = [common] * 4
        shade_vals[ci] = OPPOSITE[common]
    elif rule == "gap":
        gap_vals = [False] * 4
        gap_vals[ci] = True
    elif rule == "lines":
        common, odd = rng.sample(REAL_LINES, 2)
        line_vals = [common] * 4
        line_vals[ci] = odd
    elif rule == "mark-count":
        base = shared["marks"]
        if len(base) >= 4:
            return None
        cells = [c for c in ALLOWED_CELLS[all_frames[0]] if all(c in ALLOWED_CELLS[f] for f in all_frames)]
        free = [c for c in cells if c not in {m["cell"] for m in base}]
        if not free:
            return None
        extra = {"cell": rng.choice(free), "kind": rng.choice(KINDS), "filled": rng.random() < 0.5}
        mark_vals = [deepcopy(base) for _ in range(4)]
        mark_vals[ci] = deepcopy(base) + [extra]
    elif rule == "mark-kind":
        base = shared["marks"]
        i = rng.randrange(len(base))
        kind = rng.choice([k for k in KINDS if k != base[i]["kind"]])
        mark_vals = [deepcopy(base) for _ in range(4)]
        mark_vals[ci][i] = {**mark_vals[ci][i], "kind": kind}
    elif rule == "mark-position":
        base = shared["marks"]
        used = {m["cell"] for m in base}
        i = rng.randrange(len(base))
        cells = [c for c in ALLOWED_CELLS[all_frames[0]] if all(c in ALLOWED_CELLS[f] for f in all_frames)]
        free = [c for c in cells if c not in used]
        if not free:
            return None
        mark_vals = [deepcopy(base) for _ in range(4)]
        mark_vals[ci][i] = {**mark_vals[ci][i], "cell": rng.choice(free)}
    elif rule == "mirror":
        pass  # handled below
    elif rule == "frame-shape":
        pass  # handled above

    # --- noise values --------------------------------------------------------------
    for prop in noises:
        groups = noise_groups(rng)
        if prop == "gap":
            if len(groups) != 2:  # a bool prop can only split 2-2
                idx = list(range(4))
                rng.shuffle(idx)
                groups = [idx[:2], idx[2:]]
            for g, v in zip(groups, [True, False]):
                for i in g:
                    gap_vals[i] = v
        elif prop == "shade":
            pool = [s for s in SHADES if s != shared["shade"]]
            if len(pool) < len(groups):
                return None
            vals = rng.sample(pool, len(groups))
            for g, v in zip(groups, vals):
                for i in g:
                    shade_vals[i] = v
        elif prop == "lines":
            pool = [l for l in LINES if l != shared["lines"]]
            if len(pool) < len(groups):
                return None
            vals = rng.sample(pool, len(groups))
            for g, v in zip(groups, vals):
                for i in g:
                    line_vals[i] = v
        elif prop == "marks":
            vals = []
            tries = 0
            while len(vals) < len(groups) and tries < 30:
                tries += 1
                m = random_marks(rng, all_frames)
                if m is None:
                    return None
                k = key_of({"frame": "", "gap": False, "shade": "none", "lines": "none", "rotation": 0, "mirror": False, "marks": m})
                if all(
                    key_of({"frame": "", "gap": False, "shade": "none", "lines": "none", "rotation": 0, "mirror": False, "marks": v})
                    != k
                    for v in vals
                ) and k != key_of(
                    {"frame": "", "gap": False, "shade": "none", "lines": "none", "rotation": 0, "mirror": False, "marks": shared["marks"]}
                ):
                    vals.append(m)
            if len(vals) < len(groups):
                return None
            for g, v in zip(groups, vals):
                for i in g:
                    mark_vals[i] = deepcopy(v)

    # --- materialize ----------------------------------------------------------------
    if rule == "mirror":
        return gen_mirror(rng, ci, frame_vals[0])

    figures = [
        {
            "frame": frame_vals[i],
            "gap": gap_vals[i],
            "shade": shade_vals[i],
            "lines": line_vals[i],
            "marks": mark_vals[i],
            "rotation": 0,
            "mirror": False,
        }
        for i in range(4)
    ]
    if not valid_odd(figures, rule, ci):
        return None
    return figures, rule


def gen_mirror(rng, ci, frame):
    """Three rotations of an asymmetric figure + its mirror image."""
    base_marks = random_marks(rng, [frame], 3)
    if base_marks is None or len({m["kind"] for m in base_marks}) < 3:
        return None
    base = {
        "frame": frame,
        "gap": False,
        "shade": "none",
        "lines": rng.choice(["none", rng.choice(REAL_LINES)]),
        "marks": base_marks,
        "rotation": 0,
        "mirror": False,
    }
    if distinct_rotations(base) < 3 or not mirror_is_asymmetric(base):
        return None
    rots = rng.sample(ROTS, 3)
    mir_rot = rng.choice(rots)
    figures = []
    it = iter(rots)
    for i in range(4):
        if i == ci:
            figures.append({**deepcopy(base), "rotation": mir_rot, "mirror": True})
        else:
            figures.append({**deepcopy(base), "rotation": next(it), "mirror": False})
    if not valid_odd(figures, "mirror", ci):
        return None
    return figures, "mirror"


# --- Figure-matching -------------------------------------------------------------


def candidate_edits(spec):
    """All single-detail edits -> (key, new_spec)."""
    out = []
    marks = spec["marks"]
    used = {m["cell"] for m in marks}
    allowed = ALLOWED_CELLS[spec["frame"]]
    for i, m in enumerate(marks):
        for c in neighbours(m["cell"]):
            if c in allowed and c not in used:
                nm = deepcopy(spec)
                nm["marks"][i] = {**nm["marks"][i], "cell": c}
                out.append((f"move{i}", nm))
        for k in KINDS:
            if k != m["kind"]:
                nm = deepcopy(spec)
                nm["marks"][i] = {**nm["marks"][i], "kind": k}
                out.append((f"kind{i}", nm))
        nm = deepcopy(spec)
        nm["marks"][i] = {**nm["marks"][i], "filled": not m["filled"]}
        out.append((f"fill{i}", nm))
    if len(marks) > 1:
        for i in range(len(marks)):
            nm = deepcopy(spec)
            del nm["marks"][i]
            out.append((f"remove{i}", nm))
    if len(marks) < 4:
        for c in allowed:
            if c not in used:
                for k in KINDS:
                    nm = deepcopy(spec)
                    nm["marks"] = nm["marks"] + [
                        {"cell": c, "kind": k, "filled": True}
                    ]
                    out.append((f"add{c}{k}", nm))
    for s in SHADES:
        if s != spec["shade"]:
            nm = deepcopy(spec)
            nm["shade"] = s
            out.append((f"shade{s}", nm))
    for l in LINES:
        if l != spec["lines"]:
            nm = deepcopy(spec)
            nm["lines"] = l
            out.append((f"lines{l}", nm))
    nm = deepcopy(spec)
    nm["gap"] = not spec["gap"]
    out.append(("gap", nm))
    return out


def edit_group(key):
    """Edits that would cancel or conflict share a group."""
    for p in ("move", "kind", "fill", "remove"):
        if key.startswith(p):
            return key[: len(p) + 1]
    if key.startswith("add"):
        return "add"
    if key.startswith("shade"):
        return "shade"
    if key.startswith("lines"):
        return "lines"
    return key


def make_distractor(rng, target, k):
    spec = deepcopy(target)
    used_groups = set()
    for _ in range(k):
        cands = [
            (key, nm)
            for key, nm in candidate_edits(spec)
            if edit_group(key) not in used_groups
        ]
        if not cands:
            return None
        key, spec = rng.choice(cands)
        used_groups.add(edit_group(key))
    return spec


def random_target(rng, need_asym):
    for _ in range(40):
        frame = rng.choice(REAL_FRAMES) if rng.random() < 0.9 else "none"
        t = {
            "frame": frame,
            "gap": rng.random() < 0.25,
            "shade": rng.choice(SHADES),
            "lines": rng.choice(LINES),
            "marks": random_marks(rng, [frame]),
            "rotation": 0,
            "mirror": False,
        }
        if t["marks"] is None or len(t["marks"]) < 1:
            continue
        if need_asym and not mirror_is_asymmetric(t):
            continue
        return t
    return None


def gen_match(rng, difficulty, ci):
    need_asym = difficulty >= 3
    for _ in range(40):
        target = random_target(rng, need_asym)
        if target is None:
            return None

        options = []
        if difficulty == 1:
            ks = [rng.choice([2, 3]) for _ in range(3)]
        elif difficulty == 2:
            ks = [2, 2, 2]
        elif difficulty == 3:
            ks = [1, 1, 2]
            rng.shuffle(ks)
        else:
            ks = [1, 1, 1]

        special = (
            difficulty == 4
            and distinct_rotations(target) >= 3
            and mirror_is_asymmetric(target)
        )
        if special:
            e = effective(target)
            options.append(transform(e, 90, False))
            options.append(transform(e, 0, True))
            d = make_distractor(rng, target, 1)
            if d is None:
                continue
            options.append(d)
        else:
            for k in ks:
                d = make_distractor(rng, target, k)
                if d is None:
                    break
                options.append(d)

        if len(options) != 3:
            continue
        options.insert(ci, deepcopy(target))
        keys = [key_of(effective(o)) for o in options]
        if len(set(keys)) != 4:
            continue
        tk = key_of(effective(target))
        if [i for i, k in enumerate(keys) if k == tk] != [ci]:
            continue
        return target, options
    return None


# --- Explanations ----------------------------------------------------------------


def odd_explanation(rule, figures, ci):
    common = next(f for i, f in enumerate(figures) if i != ci)
    odd = figures[ci]
    if rule == "fill":
        return (
            f"Three figures are {SHADE_PHRASE[common['shade']]}. "
            f"This one is {SHADE_PHRASE[odd['shade']]}."
        )
    if rule == "half-shading":
        return (
            f"Three figures are {SHADE_PHRASE[common['shade']]}. "
            f"This one is {SHADE_PHRASE[odd['shade']]}."
        )
    if rule == "frame-shape":
        return (
            f"Three figures are {common['frame']}s. "
            f"This one is a {odd['frame']}."
        )
    if rule == "mark-count":
        return (
            f"Three figures have {len(common['marks'])} marks inside. "
            f"This one has {len(odd['marks'])}."
        )
    if rule == "gap":
        return "Three figures are closed shapes. This one has an opening."
    if rule == "mark-kind":
        if len(common["marks"]) == 1:
            return (
                f"Three figures have a {KIND_WORD[common['marks'][0]['kind']]} inside. "
                f"This one has a {KIND_WORD[odd['marks'][0]['kind']]}."
            )
        return "Three figures have the same marks inside. This one has a different mark."
    if rule == "mark-position":
        return "Three figures have marks in the same places. This one has a mark in a different place."
    if rule == "lines":
        return (
            f"Three figures have {LINE_PHRASE[common['lines']]}. "
            f"This one has {LINE_PHRASE[odd['lines']]}."
        )
    if rule == "mirror":
        return "Three figures are the same turned around. This one is a mirror image."
    return "Three figures are alike. This one is different."


# --- Question assembly -----------------------------------------------------------


def make_odd(rng, qid, rule, noise_n, difficulty, ci):
    r = gen_odd(rng, rule, noise_n, ci)
    if r is None:
        return None
    figures, rule = r
    text = TEXT["en"]["odd"]
    return {
        "id": qid,
        "schemaVersion": 1,
        "locale": "en",
        "galaxy": GALAXY,
        "starId": STAR_ID,
        "type": "figure-odd-one-out",
        "topic": "odd-man-out",
        "difficulty": difficulty,
        "prompt": text["prompt"],
        "explanation": odd_explanation(rule, figures, ci),
        "tags": ["figures", "odd-one-out", f"rule-{rule}"],
        "figures": figures,
        "correctIndex": ci,
        "rule": rule,
    }


def make_match(rng, qid, difficulty, ci):
    r = gen_match(rng, difficulty, ci)
    if r is None:
        return None
    target, options = r
    text = TEXT["en"]["match"]
    return {
        "id": qid,
        "schemaVersion": 1,
        "locale": "en",
        "galaxy": GALAXY,
        "starId": STAR_ID,
        "type": "figure-match",
        "topic": "figure-matching",
        "difficulty": difficulty,
        "prompt": text["prompt"],
        "explanation": text["expl"],
        "tags": ["figures", "matching"],
        "target": target,
        "options": options,
        "correctIndex": ci,
    }


def spec(frame, gap, shade, marks, lines):
    return {
        "frame": frame,
        "gap": gap,
        "shade": shade,
        "marks": marks,
        "lines": lines,
        "rotation": 0,
        "mirror": False,
    }


def main():
    rng = random.Random(SEED)

    # (topic, difficulty, rule, noise) plan — counts per the spec.
    plan = []
    for r in D1_RULES:
        plan += [("odd-man-out", 1, r, 0)] * 3
    for r in D2_RULES:
        plan += [("odd-man-out", 2, r, 0)] * 3
    d3_rules = D1_RULES + D2_RULES + rng.sample(D1_RULES + D2_RULES, 4)
    rng.shuffle(d3_rules)
    for r in d3_rules:
        plan.append(("odd-man-out", 3, r, 1))
    plan += [("odd-man-out", 4, "mirror", 0)] * 4
    for r in rng.sample(D1_RULES + D2_RULES, 4):
        plan.append(("odd-man-out", 4, r, 2))
    for diff, count in [(1, 8), (2, 8), (3, 8), (4, 4)]:
        plan += [("figure-matching", diff, None, 0)] * count
    rng.shuffle(plan)

    # Balanced correctIndex per topic (0-3 round-robin, shuffled).
    positions = {}
    for topic, total in [("odd-man-out", 44), ("figure-matching", 28)]:
        p = [i % 4 for i in range(total)]
        rng.shuffle(p)
        positions[topic] = p

    questions = []
    hashes = set()
    retries = 0
    n = 0
    for topic, diff, rule, noise in plan:
        while True:
            ci = positions[topic].pop()
            qid = f"mat-s01-{n + 1:04d}"
            q = (
                make_odd(rng, qid, rule, noise, diff, ci)
                if topic == "odd-man-out"
                else make_match(rng, qid, diff, ci)
            )
            if q is None:
                retries += 1
                positions[topic].insert(0, ci)
                continue
            if topic == "odd-man-out":
                payload = sorted(canonical(f) for f in q["figures"])
            else:
                payload = (
                    canonical(q["target"]),
                    sorted(canonical(o) for o in q["options"]),
                )
            h = hashlib.sha1(f"{topic}:{json.dumps(payload, sort_keys=True)}".encode()).hexdigest()
            if h in hashes:
                retries += 1
                positions[topic].insert(0, ci)
                continue
            hashes.add(h)
            questions.append(q)
            n += 1
            break

    kit = {
        "schemaVersion": 1,
        "galaxy": GALAXY,
        "starId": STAR_ID,
        "starIndex": STAR_INDEX,
        "tip": {
            "title": "Space Tip",
            "pages": [
                {
                    "steps": [
                        "Look at all four figures.",
                        "Three follow the same pattern. One does not.",
                        "Check the shape, the shading, what is inside and the lines.",
                    ],
                    "exampleFigures": [
                        spec("square", False, "left", [{"cell": 4, "kind": "dot", "filled": True}], "none"),
                        spec("square", False, "left", [{"cell": 4, "kind": "dot", "filled": True}], "none"),
                        spec("square", False, "none", [{"cell": 4, "kind": "dot", "filled": True}], "none"),
                        spec("square", False, "left", [{"cell": 4, "kind": "dot", "filled": True}], "none"),
                    ],
                    "highlightIndex": 2,
                },
                {
                    "steps": [
                        "Look at the given figure closely.",
                        "Check each small mark and where it sits.",
                        "Pick the one that matches in every detail.",
                    ],
                    "target": spec(
                        "triangle",
                        False,
                        "none",
                        [
                            {"cell": 4, "kind": "ring", "filled": False},
                            {"cell": 7, "kind": "dot", "filled": True},
                        ],
                        "diag-down",
                    ),
                    "options": [
                        spec(
                            "triangle",
                            False,
                            "none",
                            [
                                {"cell": 4, "kind": "ring", "filled": False},
                                {"cell": 7, "kind": "dot", "filled": True},
                            ],
                            "diag-down",
                        ),
                        spec(
                            "triangle",
                            False,
                            "none",
                            [
                                {"cell": 4, "kind": "dot", "filled": True},
                                {"cell": 7, "kind": "dot", "filled": True},
                            ],
                            "diag-down",
                        ),
                    ],
                    "correctIndex": 0,
                },
            ],
        },
        "recipe": {
            "mission": [
                {"topic": "odd-man-out", "count": 4},
                {"topic": "figure-matching", "count": 3},
            ],
            "game": {"type": "spot-the-odd-planet", "seconds": 60},
            "checkpoint": {
                "questions": 5,
                "mix": [
                    {"topic": "odd-man-out", "count": 3},
                    {"topic": "figure-matching", "count": 2},
                ],
                "passAt": 4,
            },
            "reviewPool": [],
        },
        "questions": questions,
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(kit, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # --- Summary ------------------------------------------------------------------
    by_rule = Counter(
        q.get("rule", "-") for q in questions if q["topic"] == "odd-man-out"
    )
    by_diff = Counter((q["topic"], q["difficulty"]) for q in questions)
    by_ci = Counter(q["correctIndex"] for q in questions)
    print(f"Wrote {OUT}: {len(questions)} questions")
    for topic in ("odd-man-out", "figure-matching"):
        total = sum(v for (t, _), v in by_diff.items() if t == topic)
        print(f"  {topic}: {total}")
        for d in sorted(dd for (t, dd) in by_diff if t == topic):
            print(f"    difficulty {d}: {by_diff[(topic, d)]}")
    print(f"  odd rules: {dict(sorted(by_rule.items()))}")
    print(f"  correctIndex distribution: {dict(sorted(by_ci.items()))}")
    print(f"  retries (invalid/duplicate): {retries}")


if __name__ == "__main__":
    main()
