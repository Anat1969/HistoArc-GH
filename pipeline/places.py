"""
Exact coordinates for each case from Wikidata (property P625), found through the case's
Wikimedia Commons category (property P373). Runs on GitHub's servers:
    python pipeline/places.py src/data/places_wd.json
"""
import json
import re
import sys
import urllib.parse
import urllib.request

UA = {"User-Agent": "HistoArc-research-tool/1.0 (https://github.com/Anat1969/HistoArc-GH)", "Accept": "application/sparql-results+json"}


def sparql(q):
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return json.load(r)["results"]["bindings"]


if __name__ == "__main__":
    src = open("src/data/cases.ts", encoding="utf-8").read()
    cases = re.findall(r"\{ id: (\d+),.*?commons: C \+ '([^']+)'", src)
    out = {}
    for cid, cat in cases:
        name = urllib.parse.unquote(cat).replace("_", " ")
        q = 'SELECT ?item ?itemLabel ?coord WHERE { ?item wdt:P373 "%s"; wdt:P625 ?coord. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 3' % name.replace('"', '\\"')
        try:
            rows = sparql(q)
            if rows:
                m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", rows[0]["coord"]["value"])
                if m:
                    out[cid] = {"lat": float(m.group(2)), "lon": float(m.group(1)), "item": rows[0]["item"]["value"], "label": rows[0]["itemLabel"]["value"]}
            print(cid, name, out.get(cid, "none"), file=sys.stderr)
        except Exception as e:
            print(cid, name, "error", str(e)[:100], file=sys.stderr)
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        f.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
