import csv
import io
import json
import math
import os
import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import requests
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ramps as sorter

LISTS = "https://raw.githubusercontent.com/infinitefusion/pif-downloadables/refs/heads/master/"
SETTINGS = "https://raw.githubusercontent.com/infinitefusion/infinitefusion-e18/releases/Data/Scripts/001_Settings.rb"
SITE = "https://infinitefusion.net/customsprites/"
CREDITS = SITE + "Sprite_Credits.csv"
SHEET_CUSTOM = SITE + "spritesheets/spritesheets_custom/{head}/{head}{alt}.png"
SHEET_BASE = SITE + "spritesheets/spritesheets_base/{id}.png"
# single files for the missing sprites
FILE_CUSTOM = SITE + "CustomBattlers/{id}.png"
FILE_BASE = SITE + "Other/BaseSprites/{id}.png"
SIZE = 96

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"
PALETTES = OUT / "palettes"
# caching stuff so it doesn't redo it everytime (ci keeps it outside the repo)
CACHE = Path(os.environ.get("PALETTE_CACHE", OUT / "cache")).expanduser()
ETAGS = OUT / "etags.json"

http = requests.Session()
http.headers["User-Agent"] = "pif-spriter-helper (github.com/tullio-official)"

# names in game-id order
NAMES = re.findall(r'"((?:[^"\\]|\\.)*)"', (ROOT / "shared" / "names.js").read_text(encoding="utf-8"))


# --- files ---
def text(url):
    response = http.get(url, timeout=60)
    response.raise_for_status()
    return response.content.decode("utf-8-sig")


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def letter_index(letters):
    index = 0
    for letter in letters:
        index = index * 26 + ord(letter) - 96
    return index


# --- scanning ---
def scan(cell):
    rgb = (cell[..., 0].astype(np.int32) << 16) | (cell[..., 1].astype(np.int32) << 8) | cell[..., 2]
    solid = cell[..., 3] >= 128
    if not solid.any():
        return ""
    colours, inverse, counts = np.unique(rgb[solid], return_inverse=True, return_counts=True)
    order = np.argsort(-counts, kind="stable")
    rank = np.empty_like(order)
    rank[order] = np.arange(len(order))
    index = np.full(rgb.shape, -1, np.int32)
    index[solid] = rank[inverse]
    total = len(colours)
    # pixels touching and stuff
    pairs = []
    for left, right in ((index[:, :-1], index[:, 1:]), (index[:-1], index[1:])):
        touching = (left >= 0) & (right >= 0) & (left != right)
        low, high = np.minimum(left[touching], right[touching]), np.maximum(left[touching], right[touching])
        pairs.append(low * total + high)
    keys, shared = np.unique(np.concatenate(pairs), return_counts=True)
    padded = np.pad(index, 1, constant_values=-1)
    near = (padded[:-2, 1:-1] < 0) | (padded[2:, 1:-1] < 0) | (padded[1:-1, :-2] < 0) | (padded[1:-1, 2:] < 0)
    edge = np.bincount(index[solid & near], minlength=total)
    return "|".join([
        "".join(f"{colour:06x}" for colour in colours[order]),
        ",".join(map(str, counts[order])),
        ",".join(f"{key // total}.{key % total}.{count}" for key, count in zip(keys.tolist(), shared.tolist())),
        ",".join(f"{colour}.{count}" for colour, count in enumerate(edge.tolist()) if count),
    ])


def lightness_chroma(hex):
    lightness, green, blue = sorter.oklab(hex)
    return lightness, math.hypot(green, blue)


def totals(groups):
    pixels = defaultdict(int)
    for group in groups:
        for colour, count in group["px"].items():
            pixels[colour] += count
    return pixels


def deep(groups):
    pixels = totals(groups)
    fine = [colour for colour in pixels if (lambda lightness, chroma: lightness <= 0.55 and chroma >= 0.08)(*lightness_chroma(colour))]
    return max(fine, key=pixels.get) if fine else None


def accent(groups):
    pixels = totals(groups)
    if not pixels:
        return None
    colourful = [colour for colour in pixels if lightness_chroma(colour)[1] >= 0.06]
    # tiebreaker
    return max(colourful or pixels, key=lambda colour: (pixels[colour], colour))


# --- sprited counts ---
def counts(custom, total):
    served = [0] * (total + 1)
    done = set()
    for head, alts in custom.items():
        for bodies in alts.values():
            for body in bodies:
                if head > total or body > total or (head, body) in done:
                    continue
                done.add((head, body))
                served[head] += 1
                if body != head:
                    served[body] += 1
    cutoff = sorted(served[1:])[math.ceil(total / 10) - 1]
    return {"nb": total, "cutoff": cutoff, "sprited": len(done), "served": served}


def pokemon_count():
    match = re.search(r"NB_POKEMON\s*=\s*(\d+)\s*$", text(SETTINGS), re.M)
    return int(match[1]) if match else len(NAMES)


# --- build ---
def main():
    sys.stdout.reconfigure(encoding="utf-8")
    only = {int(argument) for argument in sys.argv[1:]}

    # sprite lists
    custom = defaultdict(lambda: defaultdict(list))
    for file in text(LISTS + "CUSTOM_SPRITES").split():
        match = re.fullmatch(r"(\d+)\.(\d+)([a-z]*)\.png", file)
        if match:
            custom[int(match[1])][match[3]].append(int(match[2]))

    base = defaultdict(list)
    for file in text(LISTS + "BASE_SPRITES").split():
        match = re.fullmatch(r"(\d+)([a-z]*)\.png", file)
        if match:
            base[int(match[1])].append(match[2])

    (OUT / "counts.js").write_text("counts(" + json.dumps(counts(custom, pokemon_count()), separators=(",", ":")) + ");\n", encoding="utf-8")

    dex = range(1, len(NAMES) + 1)
    ids = [pokemon for pokemon in dex if (pokemon in base or pokemon in custom) and (not only or pokemon in only)]

    # credits
    credits = {}
    for row in csv.reader(io.StringIO(text(CREDITS))):
        if len(row) > 1:
            credits[row[0]] = row[1]

    # cached results check
    etags = read(ETAGS) if ETAGS.exists() else {}
    CACHE.mkdir(parents=True, exist_ok=True)
    old = {}
    for pokemon in ids:
        path = CACHE / f"{pokemon}.json"
        if path.exists():
            old.update(read(path))

    # every sheet
    sheets = {}
    for pokemon in ids:
        if base.get(pokemon):
            sheets[SHEET_BASE.format(id=pokemon)] = [(f"{pokemon}{alt}", letter_index(alt), 10) for alt in sorted(base[pokemon], key=letter_index)]
        for alt, bodies in custom.get(pokemon, {}).items():
            sheets[SHEET_CUSTOM.format(head=pokemon, alt=alt)] = [(f"{pokemon}.{body}{alt}", body, 20) for body in sorted(bodies)]

    scans = {}
    loose = set()
    new_etags = {} if not only else dict(etags)
    fails = []

    def fetch(url):
        sprites = sheets[url]
        cached = all(sprite in old for sprite, _, _ in sprites)
        headers = {"If-None-Match": etags[url]} if cached and url in etags else {}
        try:
            response = http.get(url, headers=headers, timeout=60)
            if response.status_code == 404:
                return singles(sprites)
            if response.status_code == 304:
                new_etags[url] = etags[url]
                for sprite, _, _ in sprites:
                    scans[sprite] = old[sprite]
                return
            response.raise_for_status()
            sheet = np.asarray(Image.open(io.BytesIO(response.content)).convert("RGBA"))
            for sprite, cell, columns in sprites:
                across, down = cell % columns * SIZE, cell // columns * SIZE
                if down + SIZE <= sheet.shape[0] and across + SIZE <= sheet.shape[1]:
                    scans[sprite] = scan(sheet[down:down + SIZE, across:across + SIZE])
            if response.headers.get("ETag"):
                new_etags[url] = response.headers["ETag"]
        except (requests.RequestException, OSError) as error:
            fails.append(f"{url} ({error})")
            new_etags.pop(url, None)
            for sprite, _, _ in sprites:
                if sprite in old:
                    scans[sprite] = old[sprite]

    def singles(sprites):
        for sprite, _, _ in sprites:
            response = http.get((FILE_CUSTOM if "." in sprite else FILE_BASE).format(id=sprite), timeout=60)
            response.raise_for_status()
            image = np.asarray(Image.open(io.BytesIO(response.content)).convert("RGBA"))
            step = image.shape[0] // SIZE
            scans[sprite] = scan(image[::step, ::step][:SIZE, :SIZE])
            loose.add(sprite)

    with ThreadPoolExecutor(4) as pool:
        for finished, _ in enumerate(pool.map(fetch, sheets), 1):
            if finished % 250 == 0:
                print(f"{finished} of {len(sheets)} sheets", flush=True)

    # groups of sprites sharing the same palette
    PALETTES.mkdir(parents=True, exist_ok=True)
    index = read(OUT / "index.json") if only and (OUT / "index.json").exists() else {}
    total = 0
    for pokemon in ids:
        own = [(f"{pokemon}{alt}", (0, number, 0)) for number, alt in enumerate(sorted(base[pokemon], key=letter_index))]
        own += [(f"{pokemon}.{body}{alt}", (1, body, letter_index(alt))) for alt in custom[pokemon] for body in custom[pokemon][alt]]
        own.sort(key=lambda sprite: sprite[1])
        groups = {}
        cache = {}
        for sprite, rank in own:
            scanned = scans.get(sprite)
            if not scanned:
                continue
            cache[sprite] = scanned
            hexes, pixel_counts, touches, edges = scanned.split("|")
            colours = [hexes[at:at + 6] for at in range(0, len(hexes), 6)]
            group = groups.setdefault(frozenset(colours), {"rank": rank, "sprites": [], "px": defaultdict(int),
                                                           "touch": defaultdict(int), "edge": defaultdict(int)})
            group["sprites"].append([sprite, credits.get(sprite, "")] + ([1] if sprite in loose else []))
            for colour, count in zip(colours, pixel_counts.split(",")):
                group["px"][colour] += int(count)
            for touch in filter(None, touches.split(",")):
                one, other, count = map(int, touch.split("."))
                group["touch"][tuple(sorted((colours[one], colours[other])))] += count
            for touch in filter(None, edges.split(",")):
                colour, count = map(int, touch.split("."))
                group["edge"][colours[colour]] += count
        if not groups:
            continue
        order = sorted(groups.values(), key=lambda group: (group["rank"][0], -len(group["sprites"]), group["rank"]))
        out = []
        for group in order:
            sorted_ramps = sorter.ramps(group["px"], group["touch"], group["edge"])
            # main colour
            main_ramp = next((ramp for ramp in sorted_ramps if max(lightness_chroma(hex)[0] for hex in ramp) > 0.35), sorted_ramps[0])
            out.append([["".join(ramp) for ramp in sorted_ramps], group["sprites"], max(main_ramp, key=group["px"].get)])
        bases = sum(1 for group in order if group["rank"][0] == 0)
        data = {"id": pokemon, "dex": pokemon, "name": NAMES[pokemon - 1], "base": bases, "deep": deep(order), "accent": accent(order),
                "groups": out}
        (PALETTES / f"{pokemon}.js").write_text(
            "palettes(" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ");\n", encoding="utf-8")
        write(CACHE / f"{pokemon}.json", cache)
        index[str(pokemon)] = len(out)
        total += len(out)

    write(OUT / "index.json", dict(sorted(index.items(), key=lambda item: int(item[0]))))
    ETAGS.write_text(json.dumps(new_etags, indent=0, sort_keys=True), encoding="utf-8")

    print(f"Finished {len(ids)} Pokémon, {total} palettes")
    if fails:
        print(f"{len(fails)} sheets failed", *fails[:20], sep="\n  ")
        if len(fails) > len(sheets) / 2:
            raise SystemExit("More than half the sheets failed, keeping last time's palettes")


main()
