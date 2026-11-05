"""
Calibration pipeline for קוד העיר: replaces the assessed θ of real cities with measured values.

Runs on GitHub's servers (Actions tab, workflow "כיול מ-OpenStreetMap"), which can reach Overpass:
    pip install -r pipeline/requirements.txt
    python pipeline/calibrate.py src/data/measured.json

Measures, per city, inside a 700 m square around the centre point (the app's plate size):
    O  Boeing (2019) orientation order φ, 36 bins, via osmnx.bearing
    E  GSI  = Σ footprint / area                         (Spacematrix 2010)
    I  FSI  = Σ footprint × floors / area, floors from building:levels, else height / 3.3, else 2 [ה]
    G  √(area / number of street blocks)
    wall  share of street length with a building within 3 m (relation R)
H is not computed here: use depthmapX integration variance and report the radius.
Each value is written with method, source, state year and confidence, per spec section 5.
"""
import json
import math

import geopandas as gpd
import osmnx as ox

import time

HALF = 350  # metres
# the public Overpass servers are often at capacity: rotate between them and back off
ENDPOINTS = ["https://overpass-api.de/api", "https://overpass.private.coffee/api", "https://overpass.kumi.systems/api"]
ox.settings.requests_timeout = 300
ox.settings.use_cache = True

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


def phi(G):
    Gu = ox.convert.to_undirected(ox.bearing.add_edge_bearings(G))
    H0 = ox.bearing.orientation_entropy(Gu, num_bins=36)
    Hg, Hmax = math.log(4), math.log(36)
    return max(0.0, 1 - ((H0 - Hg) / (Hmax - Hg)) ** 2) if H0 > Hg else 1.0


def floors(row):
    lv = row.get("building:levels")
    try:
        return max(1.0, float(lv))
    except (TypeError, ValueError):
        pass
    try:
        return max(1.0, float(str(row.get("height")).split()[0]) / 3.3)
    except (TypeError, ValueError):
        return 2.0  # assumption [נ]


def measure(lat, lon):
    G = ox.graph_from_point((lat, lon), dist=HALF, dist_type="bbox", network_type="all", simplify=True)
    Gp = ox.project_graph(G)
    b = ox.features_from_point((lat, lon), tags={"building": True}, dist=HALF)
    b = b[b.geometry.type.isin(["Polygon", "MultiPolygon"])].to_crs(Gp.graph["crs"])
    nodes, edges = ox.graph_to_gdfs(Gp)
    c = nodes.union_all().centroid
    box = gpd.GeoSeries([c.buffer(HALF, cap_style=3)], crs=Gp.graph["crs"])
    area = float(box.area.iloc[0])
    b = gpd.clip(b, box)
    fp = b.geometry.area
    fl = b.apply(floors, axis=1)
    blocks = box.iloc[0].difference(edges.buffer(4).union_all())
    n_blocks = len(getattr(blocks, "geoms", [blocks]))
    edges = gpd.clip(edges, box)
    near = edges.geometry.length.sum()
    # street length that runs within 6 m of a building face: the street wall (relation R)
    lined = edges.geometry.intersection(b.buffer(6).union_all()).length.sum() if len(b) else 0.0
    return {
        "O": round(phi(G), 3),  # bearings need the unprojected graph
        "E": round(float(fp.sum() / area), 3),
        "I": round(float((fp * fl).sum() / area), 3),
        "G": round(math.sqrt(area / max(n_blocks, 1)), 1),
        "wall": round(min(1.0, float(lined / near)) if near else 0.0, 2),
        "method": "osmnx_phi+spacematrix",
        "source": "OpenStreetMap (ODbL)",
        "confidence": 0.6,
    }


if __name__ == "__main__":
    import datetime
    import sys

    out = {}
    for cid, (name, lat, lon) in CITIES.items():
        last = None
        for attempt in range(6):
            ox.settings.overpass_url = ENDPOINTS[attempt % len(ENDPOINTS)]
            try:
                out[cid] = {"name": name, "state_year": datetime.date.today().year, "endpoint": ox.settings.overpass_url, **measure(lat, lon)}
                break
            except Exception as e:  # retry, then report the gap
                last = str(e).splitlines()[0][:200]
                time.sleep(min(240, 15 * 2**attempt))
        else:
            out[cid] = {"name": name, "error": last}
        print(name, "ok" if "error" not in out[cid] else out[cid]["error"], file=sys.stderr, flush=True)
    text = json.dumps(out, ensure_ascii=False, indent=2)
    if len(sys.argv) > 1:
        open(sys.argv[1], "w", encoding="utf-8").write(text + "\n")
    print(text)
