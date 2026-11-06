"""
Collects one photograph per case from its Wikimedia Commons category, with author and licence.
Runs on GitHub's servers (Commons is not reachable from the build sandbox):
    python pipeline/images.py src/data/images.json
Only freely licensed files are kept (CC, public domain). The page text names the choice as automatic.
"""
import html
import json
import re
import sys
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "HistoArc-research-tool/1.0 (https://github.com/Anat1969/HistoArc-GH)"}
FREE = re.compile(r"^(CC|Public domain|PD)", re.I)


def api(**params):
    params.update(format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def pick(category):
    files = api(action="query", list="categorymembers", cmtitle="Category:" + category, cmtype="file", cmlimit=40)["query"]["categorymembers"]
    titles = [f["title"] for f in files if re.search(r"\.(jpe?g|png)$", f["title"], re.I)]
    for i in range(0, len(titles), 20):
        q = api(action="query", titles="|".join(titles[i : i + 20]), prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=800)
        for p in q["query"]["pages"]:
            ii = (p.get("imageinfo") or [{}])[0]
            md = ii.get("extmetadata", {})
            lic = strip(md.get("LicenseShortName", {}).get("value"))
            if not FREE.match(lic) or ii.get("width", 0) < 800:
                continue
            return {
                "title": p["title"],
                "thumb": ii.get("thumburl"),
                "page": ii.get("descriptionurl"),
                "author": strip(md.get("Artist", {}).get("value"))[:120],
                "license": lic,
                "licenseUrl": strip(md.get("LicenseUrl", {}).get("value")),
                "desc": strip(md.get("ImageDescription", {}).get("value"))[:200],
            }
    return None


if __name__ == "__main__":
    src = open("src/data/cases.ts", encoding="utf-8").read()
    cases = re.findall(r"\{ id: (\d+),.*?commons: C \+ '([^']+)'", src)
    out = {}
    for cid, cat in cases:
        try:
            img = pick(cat)
            if img:
                out[cid] = img
            print(cid, cat, "ok" if img else "no free image", file=sys.stderr)
        except Exception as e:
            print(cid, cat, "error", str(e)[:120], file=sys.stderr)
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        f.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
