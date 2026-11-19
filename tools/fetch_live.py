"""Fetch the latest World Bank data and place new years on the thesis scale.

Run weekly by .github/workflows/live-data.yml; writes docs/data/live.json.

For every sample country it downloads the twelve analysis indicators and
population from the World Bank WDI API (2015 onwards) and computes a
*provisional* annual PPI with the published parameters in docs/data/ppi_scale.json
(pooled country-period means, SDs and min–max; at least four of six indicators).
Complete country-years are assigned to the nearest published profile centre.

Two checks are reported in the file so readers can judge the live layer:
* agreement: correlation and mean absolute difference between the live PPI and
  the thesis annual PPI for overlapping years (differences come from data revisions);
* coverage: countries with a provisional PPI in each year.

The live layer never changes the thesis results. Standard library only.
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
FIRST = 2015
WDI = {
    "renewable_energy": "EG.FEC.RNEW.ZS",
    "forest_pct": "AG.LND.FRST.ZS",
    "agri_land": "AG.LND.AGRI.ZS",
    "fertilizer": "AG.CON.FERT.ZS",
    "pm25": "EN.ATM.PM25.MC.M3",
    "energy_use_pc": "EG.USE.PCAP.KG.OE",
    "gdp_pc": "NY.GDP.PCAP.CD",
    "life_expectancy": "SP.DYN.LE00.IN",
    "infant_mortality": "SP.DYN.IMRT.IN",
    "urban_population_pct": "SP.URB.TOTL.IN.ZS",
    "unemployment": "SL.UEM.TOTL.ZS",
    "female_labor": "SL.TLF.CACT.FE.ZS",
    "population": "SP.POP.TOTL",
}
UA = {"User-Agent": "ppi-pathways-live-data/1.0 (+https://github.com/sahiljangra12/Thesis)"}


def get(url: str, tries: int = 4) -> bytes:
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read()
        except Exception as e:
            if k == tries - 1:
                raise
            print(f"retry {url}: {e}", file=sys.stderr)
            time.sleep(5 * (k + 1))
    raise RuntimeError("unreachable")


def wdi(code: str, year_to: int) -> tuple[dict, str]:
    out: dict[str, dict[int, float]] = {}
    page, pages, updated = 1, 1, ""
    while page <= pages:
        url = (f"https://api.worldbank.org/v2/country/all/indicator/{code}"
               f"?format=json&per_page=20000&date={FIRST}:{year_to}&page={page}")
        payload = json.loads(get(url))
        if not isinstance(payload, list) or len(payload) < 2:
            raise RuntimeError(f"unexpected response for {code}: {str(payload)[:200]}")
        meta, rows = payload
        pages, updated = int(meta.get("pages", 1)), meta.get("lastupdated", updated)
        for r in rows or []:
            iso, v = r.get("countryiso3code"), r.get("value")
            if iso and v is not None:
                out.setdefault(iso, {})[int(r["date"])] = float(v)
        page += 1
    return out, updated


def ppi(v: dict, P: dict) -> tuple[float | None, int]:
    z = []
    for var in P["ppi_vars"]:
        x = v.get(var)
        if x is None:
            continue
        coded = -x if var in P["ppi_inverse"] else x
        z.append((coded - P["z_mean"][var]) / P["z_sd"][var])
    if len(z) < P["ppi_min_indicators"]:
        return None, len(z)
    raw = sum(z) / len(z)
    return (raw - P["raw_min"]) / (P["raw_max"] - P["raw_min"]) * 100, len(z)


def profile(v: dict, P: dict) -> str | None:
    vals = []
    for var in P["cluster_vars"]:
        x = v.get(var)
        if x is None:
            return None
        vals.append(x)
    zs = [(x - m) / s for x, m, s in zip(vals, P["scaler_mean"], P["scaler_scale"], strict=True)]
    d = [sum((a - b) ** 2 for a, b in zip(zs, c, strict=True)) for c in P["centers"]]
    return P["center_labels"][d.index(min(d))]


def main() -> int:
    now = datetime.now(timezone.utc)
    P = json.loads((DATA / "ppi_scale.json").read_text(encoding="utf-8"))
    annual = json.loads((DATA / "thesis_annual.json").read_text(encoding="utf-8"))
    years_thesis = annual["years"]
    series, updated = {}, {}
    for var, code in WDI.items():
        series[var], updated[var] = wdi(code, now.year)
    countries, pairs, coverage = {}, [], {}
    for iso, c in annual["countries"].items():
        ys = sorted({y for s in series.values() for y in s.get(iso, {})})
        rows = {}
        for y in ys:
            v = {var: series[var].get(iso, {}).get(y) for var in WDI}
            gdp = v.get("gdp_pc")
            v["log_gdp_pc"] = math.log(gdp) if gdp and gdp > 0 else None
            p, n = ppi(v, P)
            v["ppi"] = p
            rows[y] = {"ppi": None if p is None else round(p, 2), "n_ind": n, "profile": profile(v, P),
                       "le": v["life_expectancy"], "gdp": None if gdp is None else round(gdp, 1),
                       "pop": v["population"]}
            if p is not None:
                coverage[y] = coverage.get(y, 0) + 1
                if y in years_thesis:
                    t = c["ppi"][years_thesis.index(y)]
                    if t is not None:
                        pairs.append((t, p))
        countries[iso] = {"n": c["n"], "years": rows}
    agree = None
    if len(pairs) > 10:
        n = len(pairs)
        mx, my = sum(a for a, _ in pairs) / n, sum(b for _, b in pairs) / n
        sxy = sum((a - mx) * (b - my) for a, b in pairs)
        sx = math.sqrt(sum((a - mx) ** 2 for a, _ in pairs))
        sy = math.sqrt(sum((b - my) ** 2 for _, b in pairs))
        agree = {"pairs": n, "r": round(sxy / (sx * sy), 4),
                 "mean_abs_diff": round(sum(abs(a - b) for a, b in pairs) / n, 3)}
    payload = {
        "fetched": now.strftime("%Y-%m-%dT%H:%MZ"),
        "source": "World Bank World Development Indicators API",
        "last_updated": updated,
        "codes": WDI,
        "rule": "Provisional: published PPI scale and profile centres applied to the latest WDI values; "
                "no re-estimation. Not part of the thesis results.",
        "agreement_with_thesis": agree,
        "coverage": {str(k): v for k, v in sorted(coverage.items())},
        "countries": countries,
    }
    (DATA / "live.json").write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
                                    encoding="utf-8")
    print(f"wrote docs/data/live.json: {len(countries)} countries; coverage {payload['coverage']}; "
          f"agreement {agree}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
