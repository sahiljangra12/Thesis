"""Run the full analysis and write every result, figure and web data file.

Usage:
    python -m ppi_pathways            # from the repository root, with src/ on the path
    python -m ppi_pathways --check    # also fail if outputs differ from the committed ones
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import pandas as pd

from . import clustering, config, data, figures, index, regression


@dataclass
class Results:
    sample: pd.DataFrame
    periods: pd.DataFrame
    clustered: pd.DataFrame
    model: clustering.ClusterModel
    k_diag: pd.DataFrame
    transitions: dict[str, pd.DataFrame]
    regressions: pd.DataFrame
    tables: dict[str, pd.DataFrame] = field(default_factory=dict)


def run() -> Results:
    sample = data.select_sample(data.load_panel(), data.load_states())
    periods = index.build_ppi(data.period_means(sample))
    k_diag = clustering.k_diagnostics(periods)
    clustered, model = clustering.fit_clusters(periods)
    pairs = list(zip(list(config.PERIODS)[:-1], list(config.PERIODS)[1:], strict=True))
    trans = {f"{config.PERIOD_LABELS[a]} → {config.PERIOD_LABELS[b]}":
             clustering.transition_matrix(clustered, a, b) for a, b in pairs}
    reg = regression.ppi_regressions(periods)
    res = Results(sample, periods, clustered, model, k_diag, trans, reg)
    res.tables = build_tables(res)
    return res


def describe(periods: pd.DataFrame) -> pd.DataFrame:
    labels = {"ppi": "PPI (0–100)", "renewable_energy": "Renewable energy (%)",
              "forest_pct": "Forest cover (%)", "agri_land": "Agricultural land (%)",
              "fertilizer": "Fertiliser use (kg/ha)", "pm25": "PM2.5 exposure (µg/m³)",
              "energy_use_pc": "Energy use per capita (kgoe)", "gdp_pc": "GDP per capita (US$)",
              "life_expectancy": "Life expectancy (years)",
              "infant_mortality": "Infant mortality (per 1,000)",
              "urban_population_pct": "Urbanisation (%)", "female_labor": "Female labour participation (%)",
              "unemployment": "Unemployment (%)"}
    rows = []
    for var, label in labels.items():
        for p in config.PERIODS:
            col = periods.loc[periods["period"] == p, var].dropna()
            rows.append({"variable": label, "period": config.PERIOD_LABELS[p], "mean": col.mean(),
                         "sd": col.std(), "min": col.min(), "max": col.max(), "n": len(col)})
    return pd.DataFrame(rows)


def build_tables(res: Results) -> dict[str, pd.DataFrame]:
    labels = res.model.labels()
    summary = []
    for p in config.PERIODS:
        sub = res.periods[res.periods["period"] == p]
        cl = res.clustered[res.clustered["period"] == p]
        row = {"period": config.PERIOD_LABELS[p], "countries": sub["iso3"].nunique(),
               "countries_with_ppi": int(sub["ppi"].notna().sum()),
               "countries_clustered": len(cl), "mean_ppi": sub["ppi"].mean(),
               "median_ppi": sub["ppi"].median()}
        row.update({f"n_{c}": int((cl["cluster"] == c).sum()) for c in config.CLUSTER_CODES})
        summary.append(row)

    centroids = res.model.centroids().round(3)
    centroids.insert(0, "label", [labels[c] for c in centroids.index])
    centroids.index.name = "cluster"

    assignments = (res.clustered[["iso3", "country", "period", "cluster"]]
                   .assign(period=lambda d: d["period"].map(config.PERIOD_LABELS))
                   .pivot(index=["iso3", "country"], columns="period", values="cluster")
                   .reindex(columns=list(config.PERIOD_LABELS.values()))
                   .reset_index())

    trans_rows = []
    for name, m in res.transitions.items():
        long = m.stack().rename("countries").reset_index()
        long.columns = ["from", "to", "countries"]
        long.insert(0, "transition", name)
        trans_rows.append(long)
    persistence = pd.DataFrame([{"transition": n, "stayed_in_cluster": clustering.persistence(m),
                                 "countries": int(m.values.sum())} for n, m in res.transitions.items()])

    return {
        "summary": pd.DataFrame(summary).round(3),
        "descriptives": describe(res.periods).round(3),
        "k_diagnostics": res.k_diag.round(4),
        "cluster_centroids": centroids.reset_index(),
        "cluster_assignments": assignments,
        "transitions": pd.concat(trans_rows, ignore_index=True),
        "persistence": persistence.round(4),
        "regressions": res.regressions.round(4),
        "sample": (res.sample[["iso3", "country"]].drop_duplicates().sort_values("iso3")
                   .reset_index(drop=True)),
    }


def write_outputs(res: Results) -> None:
    config.RESULTS_DIR.mkdir(exist_ok=True)
    with pd.ExcelWriter(config.RESULTS_DIR / "thesis_results.xlsx") as xl:
        for name, table in res.tables.items():
            table.to_excel(xl, sheet_name=name[:31], index=False)
    csv_dir = config.RESULTS_DIR / "csv"
    csv_dir.mkdir(exist_ok=True)
    for name, table in res.tables.items():
        table.to_csv(csv_dir / f"{name}.csv", index=False, float_format="%.4f")

    labels = res.model.labels()
    f = config.FIGURES_DIR
    figures.k_diagnostics(res.k_diag, config.K, f / "fig1_k_diagnostics.png")
    figures.ppi_by_period(res.periods, f / "fig2_ppi_by_period.png")
    figures.clusters_by_period(res.clustered, labels, f / "fig3_clusters_by_period.png")
    figures.transitions(res.transitions, f / "fig4_transitions.png")
    figures.regression_dots(res.regressions, f / "fig5_ppi_correlations.png")

    write_animation_data(res, labels)


def write_animation_data(res: Results, labels: dict[str, str]) -> None:
    """Data for docs/index.html: every clustered country-period."""
    regions = {}
    regions_file = config.DATA_DIR / "country_regions.csv"
    if regions_file.exists():
        regions = pd.read_csv(regions_file).set_index("iso3")["region"].to_dict()
    payload = {
        "periods": list(config.PERIOD_LABELS.values()),
        "clusters": {c: {"label": labels[c], "color": config.CLUSTER_COLORS[c]}
                     for c in config.CLUSTER_CODES},
        "rows": {},
    }
    for p, label in config.PERIOD_LABELS.items():
        sub = res.clustered[res.clustered["period"] == p]
        payload["rows"][label] = [
            {"country": r.country, "iso3": r.iso3, "cl": r.cluster, "ppi": round(r.ppi, 2),
             "life_exp": round(r.life_expectancy, 2), "gdp": round(r.gdp_pc, 1),
             "pop": int(r.population), "region": regions.get(r.iso3, "")}
            for r in sub.itertuples()
        ]
    config.DOCS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (config.DOCS_DATA_DIR / "ppi_animation.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main(argv=None) -> int:
    import argparse
    import subprocess

    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true",
                        help="exit non-zero if the regenerated results/csv differ from git")
    args = parser.parse_args(argv)

    res = run()
    write_outputs(res)
    s = res.tables["summary"]
    print(s.to_string(index=False))
    print(f"\nSilhouette (K={config.K}): {res.model.silhouette:.3f}")
    print(res.tables["persistence"].to_string(index=False))

    if args.check:
        diff = subprocess.run(["git", "diff", "--stat", "--", "results/csv", "docs/data"],
                              cwd=config.ROOT, capture_output=True, text=True).stdout
        if diff.strip():
            print("\nOutputs changed compared with the committed versions:\n" + diff)
            return 1
        print("\nOutputs match the committed versions.")
    return 0
