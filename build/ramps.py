import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np

# colour ramp sorter: an extremely overcomplicated way to group colours
MODEL = Path(__file__).resolve().parent / "ramps_model.json"
JOIN = 0.40  # average same-ramp chance needed to merge two groups


def oklab(hex):
    def linear(channel):
        channel /= 255
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
    red, green, blue = (linear(int(hex[at:at + 2], 16)) for at in (0, 2, 4))
    long = (0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue) ** (1 / 3)
    middle = (0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue) ** (1 / 3)
    short = (0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue) ** (1 / 3)
    return (0.2104542553 * long + 0.7936177850 * middle - 0.0040720468 * short,
            1.9779984951 * long - 2.4285922050 * middle + 0.4505937099 * short,
            0.0259040371 * long + 0.7827717662 * middle - 0.8086757660 * short)


class Palette:

    def __init__(self, px, touch, edge):
        self.px, self.edge = px, edge
        self.lab = {hex: oklab(hex) for hex in px}
        self.lightness = {hex: self.lab[hex][0] for hex in px}
        self.chroma = {hex: math.hypot(self.lab[hex][1], self.lab[hex][2]) for hex in px}
        self.bound, self.lighter = defaultdict(int), defaultdict(int)
        self.kinds = defaultdict(int)  # how many other colours each one touches
        self.neighbours = defaultdict(dict)
        for (one, other), count in touch.items():
            self.bound[one] += count
            self.bound[other] += count
            self.kinds[one] += 1
            self.kinds[other] += 1
            self.neighbours[one][other] = self.neighbours[other][one] = count
            if self.lightness[other] > self.lightness[one]:
                self.lighter[one] += count
            elif self.lightness[one] > self.lightness[other]:
                self.lighter[other] += count

    def pair_features(self, first, second):
        shared = self.neighbours[first].get(second, 0)
        share_first = shared / self.bound[first] if self.bound[first] else 0
        share_second = shared / self.bound[second] if self.bound[second] else 0
        (light_first, green_first, blue_first), (light_second, green_second, blue_second) = self.lab[first], self.lab[second]
        chroma_first, chroma_second = self.chroma[first], self.chroma[second]
        # the hue math of the colour difference
        hue_gap = math.sqrt(max(0.0, (green_first - green_second) ** 2 + (blue_first - blue_second) ** 2 - (chroma_first - chroma_second) ** 2))
        edge_first, edge_second = self.edge.get(first, 0) / self.px[first], self.edge.get(second, 0) / self.px[second]

        # how liney each is
        liney_first = (self.bound[first] + self.edge.get(first, 0)) / self.px[first]
        liney_second = (self.bound[second] + self.edge.get(second, 0)) / self.px[second]
        lighter_first = self.lighter[first] / self.bound[first] if self.bound[first] else 0
        lighter_second = self.lighter[second] / self.bound[second] if self.bound[second] else 0
        return [max(share_first, share_second), min(share_first, share_second), math.log1p(shared), abs(light_first - light_second), hue_gap,
                abs(chroma_first - chroma_second), (chroma_first + chroma_second) / 2, min(chroma_first, chroma_second),
                (light_first + light_second) / 2, float(chroma_first < .03 and chroma_second < .03), max(edge_first, edge_second),
                float(shared > 0), hue_gap / (0.02 + min(chroma_first, chroma_second)), min(light_first, light_second),
                max(light_first, light_second), min(edge_first, edge_second), min(liney_first, liney_second), max(liney_first, liney_second),
                min(lighter_first, lighter_second), max(lighter_first, lighter_second), float(light_first < 0.25 and light_second < 0.25)]


def chance(model, rows):
    scaled = (np.asarray(rows, float) - model["mean"]) / model["scale"]
    return 1 / (1 + np.exp(-(scaled @ model["coef"] + model["bias"])))


_models = None


def models():
    global _models
    if _models is None:
        raw = json.loads(MODEL.read_text(encoding="utf-8"))
        _models = {name: {field: np.asarray(value) for field, value in model.items()} for name, model in raw.items()}
    return _models


def ramps(px, touch, edge):
    palette = Palette(px, touch, edge)
    colours = sorted(px)
    count = len(colours)

    # kinda progressive grouping, but with probabilities?? sure
    chances = np.zeros((count, count))
    if count > 1:
        upper = np.triu_indices(count, 1)
        chances[upper] = chance(models()["pair"], [palette.pair_features(colours[one], colours[other]) for one, other in zip(*upper)])
        chances += chances.T
    sums = chances.copy()  # summed chances between groups
    sizes = np.ones(count)
    members = [[index] for index in range(count)]
    alive = np.ones(count, bool)
    while alive.sum() > 1:
        average = sums / np.outer(sizes, sizes)
        average[~alive, :] = average[:, ~alive] = -1
        np.fill_diagonal(average, -1)
        one, other = np.unravel_index(np.argmax(average), average.shape)
        if average[one, other] <= JOIN:
            break
        sums[one, :] += sums[other, :]
        sums[:, one] += sums[:, other]
        sizes[one] += sizes[other]
        members[one] += members[other]
        alive[other] = False

    groups = [sorted((colours[index] for index in members[group]), key=lambda hex: -palette.lightness[hex]) for group in range(count) if alive[group]]
    groups.sort(key=lambda group: (-sum(px[hex] for hex in group), group))
    return groups
