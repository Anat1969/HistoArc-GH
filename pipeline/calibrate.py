"""
Calibration pipeline for קוד העיר: replaces the assessed θ of real cities with measured values.

Source: Overture Maps (open data derived largely from OpenStreetMap, hosted on public cloud storage,
no rate limit). The public Overpass servers refused automated requests from GitHub's runners,
so this version does not use Overpass at all.

Runs on GitHub's servers (Actions tab, workflow "כיול מ-OpenStreetMap"):
    pip install -r pipeline/requirements.txt
    python pipeline/calibrate.py src/data/measured.json

Measures, per city, inside a 700 m square around the centre point (the app's plate size),
with the same definitions the generator uses:
    O     Boeing (2019) orientation order φ: 36 bins of 10°, both directions, weighted by length
    E     GSI  = Σ footprint / area                                  (Spacematrix 2010)
    I     FSI  = Σ footprint × floors / area; floors = num_floors, else height / 3.3, else 2 [נ]
    G     √(area / number of street blocks), blocks = polygons enclosed by road segments
    wall  share of road length within 6 m of a building (relation R)
H is not computed here: use depthmapX integration variance and report the radius.
The file is written after every city, so a stopped run keeps what it measured.
"""
import datetime
import json
import math
import sys

import shapely
from overturemaps import core
from shapely.ops import polygonize, unary_union

HALF = 350  # metres
# streets that form blocks, as in Boeing's drive network, with a typical half width (m) to the facade [ה]
HALF_WIDTH = {
    "motorway": 15, "trunk": 14, "primary": 12, "secondary": 10, "tertiary": 9,
    "residential": 7, "unclassified": 6, "living_street": 5, "pedestrian": 4,
}
RELEASE = None  # latest Overture release

CITIES = {  # case id: (name, lat, lon), the ten cities of spec section 11.1
    19: ("Eixample, Barcelona", 41.3917, 2.1649),
    18: ("Paris", 48.8738, 2.2950),
    8: ("Fès el-Bali", 34.0644, -4.9733),
    22: ("Tel Aviv", 32.0771, 34.7746),
    27: ("Ashdod", 31.7918, 34.6497),
    26: ("Chandigarh", 30.7333, 76.7794),
    28: ("Brasília", -15.7939, -47.8828),
    17: ("Manhattan", 40.7549, -73.9840),
    7: ("Kyoto", 35.0116, 135.7681),
    10: ("Siena", 43.3186, 11.3307),
}


def to_local(lat0, lon0):
    """equirectangular projection to metres around the centre: error < 0.1% over 700 m"""
    kx = 111320.0 * math.cos(math.radians(lat0))
    ky = 110540.0
    return lambda g: shapely.transform(g, lambda c: (c - [lon0, lat0]) * [kx, ky])


def fetch(kind, lat, lon):
    dlat = (HALF * 1.2) / 110540.0
    dlon = (HALF * 1.2) / (111320.0 * math.cos(math.radians(lat)))
    reader = core.record_batch_reader(kind, (lon - dlon, lat - dlat, lon + dlon, lat + dlat), release=RELEASE)
    rows = []
    for batch in reader:
        rows.extend(batch.to_pylist())
    return rows


def phi(lines):
    bins = [0.0] * 36
    for ln in lines:
        c = list(ln.coords)
        for (x1, y1), (x2, y2) in zip(c, c[1:]):
            L = math.hypot(x2 - x1, y2 - y1)
            if L < 1e-6:
                continue
            deg = math.degrees(math.atan2(x2 - x1, y2 - y1))
            for d in (deg, deg + 180):
                bins[int((((d + 5) % 360) + 360) % 360 // 10) % 36] += L
    tot = sum(bins)
    H0 = -sum(b / tot * math.log(b / tot) for b in bins if b > 0)
    Hg, Hmax = math.log(4), math.log(36)
    return 1.0 if H0 <= Hg else max(0.0, 1 - ((H0 - Hg) / (Hmax - Hg)) ** 2)


def floors(row):
    if row.get("num_floors"):
        return max(1.0, float(row["num_floors"]))
    if row.get("height"):
        return max(1.0, float(row["height"]) / 3.3)
    return 2.0  # assumption [נ]


def measure(lat, lon):
    proj = to_local(lat, lon)
    box = shapely.box(-HALF, -HALF, HALF, HALF)
    area = box.area

    roads = []
    widths = []
    for r in fetch("segment", lat, lon):
        if r.get("subtype") != "road" or r.get("class") not in HALF_WIDTH:
            continue  # footways, sidewalks, service roads and paths do not form blocks
        g = proj(shapely.from_wkb(r["geometry"])).intersection(box)
        for part in getattr(g, "geoms", [g]):
            if part.geom_type == "LineString" and not part.is_empty:
                roads.append(part)
                widths.append(HALF_WIDTH[r["class"]])

    fp = 0.0
    fa = 0.0
    shapes = []
    for b in fetch("building", lat, lon):
        g = proj(shapely.from_wkb(b["geometry"])).intersection(box)
        if g.is_empty or g.area <= 0:
            continue
        shapes.append(g)
        fp += g.area
        fa += g.area * floors(b)

    noded = unary_union(roads + [box.boundary])
    blocks = [p for p in polygonize(noded) if p.area > 200]
    length = sum(g.length for g in roads)
    # street wall: the stretch of street whose facade line (half width + 4 m) meets a building
    built = unary_union(shapes) if shapes else None
    zones = {w: built.buffer(w + 4) for w in set(widths)} if built else {}
    lined = sum(g.intersection(zones[w]).length for g, w in zip(roads, widths)) if built else 0.0
    return {
        "O": round(phi(roads), 3),
        "E": round(fp / area, 3),
        "I": round(fa / area, 3),
        "G": round(math.sqrt(area / max(len(blocks), 1)), 1),
        "wall": round(min(1.0, lined / length), 2) if length else 0.0,
        "roads": len(roads),
        "buildings": len(shapes),
        "method": "boeing_phi+spacematrix",
        "source": "Overture Maps (OpenStreetMap-derived, ODbL)",
        "confidence": 0.6,
    }


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    out = {}
    for cid, (name, lat, lon) in CITIES.items():
        try:
            out[cid] = {"name": name, "state_year": datetime.date.today().year, **measure(lat, lon)}
        except Exception as e:  # keep going, report the gap
            out[cid] = {"name": name, "error": str(e).splitlines()[0][:200]}
        print(name, "ok" if "error" not in out[cid] else out[cid]["error"], file=sys.stderr, flush=True)
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(out, ensure_ascii=False, indent=2))
