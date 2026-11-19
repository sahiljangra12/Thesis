"""Year-by-year extension of the period analysis.

The thesis is estimated on period averages (1990–2000, 2001–2010, 2011–2023). This
module projects every country-year onto the *same* scales so the results can be
followed year by year without re-estimating anything:

* Annual PPI uses the pooled country-period means and standard deviations for the
  z-scores and the pooled country-period minimum and maximum for the 0–100
  rescaling. A country-year therefore sits on the same scale as the period values;
  because single years are noisier than decade averages, annual values can fall
  slightly outside 0–100.
* Annual profiles assign each complete country-year to the nearest centre of the
  fitted period k-means model (same scaler, same centres, same labels).
* Annual statistics add uncertainty: country-cluster bootstrap intervals for the
  mean PPI, Fisher-z intervals for correlations, and a within-country trend with
  country-clustered standard errors.

Nothing here changes the period results.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from . import config
from .clustering import ClusterModel

N_BOOT = 2000
OUTCOMES = (
    config.SE_LABELS
)  # log_gdp_pc, life_expectancy, infant_mortality, urban, unemployment, female_labor


def period_scale(periods: pd.DataFrame) -> dict:
    """Pooled parameters of the period PPI: mean and SD of each coded indicator, raw min and max."""
    coded = pd.DataFrame(
        {v: (-periods[v] if v in config.PPI_INVERSE else periods[v]) for v in config.PPI_VARS}
    )
    mu, sd = coded.mean(), coded.std()
    z = (coded - mu) / sd
    n = z.notna().sum(axis=1)
    raw = z.mean(axis=1).where(n >= config.PPI_MIN_INDICATORS)
    return {"mean": mu, "sd": sd, "raw_min": float(raw.min()), "raw_max": float(raw.max())}


def annual_ppi(sample: pd.DataFrame, scale: dict) -> pd.DataFrame:
    """Country-year PPI on the period scale."""
    out = sample[["iso3", "country", "year", *config.PPI_VARS, *config.SE_VARS, "population"]].copy()
    z = pd.DataFrame(index=out.index)
    for v in config.PPI_VARS:
        coded = -out[v] if v in config.PPI_INVERSE else out[v]
        z[v] = (coded - scale["mean"][v]) / scale["sd"][v]
    out["ppi_n_indicators"] = z.notna().sum(axis=1)
    raw = z.mean(axis=1).where(out["ppi_n_indicators"] >= config.PPI_MIN_INDICATORS)
    out["ppi"] = (raw - scale["raw_min"]) / (scale["raw_max"] - scale["raw_min"]) * 100
    gdp = out["gdp_pc"].where(out["gdp_pc"] > 0)
    out["log_gdp_pc"] = np.log(gdp)
    return out.sort_values(["iso3", "year"]).reset_index(drop=True)


def annual_profiles(annual: pd.DataFrame, model: ClusterModel) -> pd.Series:
    """Nearest period centre for every complete country-year (NaN where a variable is missing)."""
    ok = annual[config.CLUSTER_VARS].notna().all(axis=1)
    lab = pd.Series(pd.NA, index=annual.index, dtype="object")
    if ok.any():
        X = model.scaler.transform(annual.loc[ok, config.CLUSTER_VARS])
        lab[ok] = [model.label_map[int(i)] for i in model.kmeans.predict(X)]
    return lab


def _boot_mean_ci(
    values: np.ndarray, rng: np.random.Generator, n_boot: int = N_BOOT
) -> tuple[float, float]:
    """Percentile bootstrap interval for a mean, resampling countries."""
    idx = rng.integers(0, len(values), size=(n_boot, len(values)))
    means = values[idx].mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def fisher_ci(r: float, n: int) -> tuple[float, float]:
    """95% confidence interval for a Pearson correlation (Fisher z)."""
    if n <= 3 or not np.isfinite(r):
        return np.nan, np.nan
    z, se = np.arctanh(r), 1 / np.sqrt(n - 3)
    return float(np.tanh(z - 1.96 * se)), float(np.tanh(z + 1.96 * se))


def yearly_stats(
    annual: pd.DataFrame, seed: int = config.RANDOM_STATE
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Per-year PPI summary with bootstrap CI and profile shares; per-year correlations with CIs."""
    rng = np.random.default_rng(seed)
    rows, cors = [], []
    for year, sub in annual.groupby("year"):
        v = sub["ppi"].dropna().to_numpy()
        lo, hi = _boot_mean_ci(v, rng) if len(v) > 1 else (np.nan, np.nan)
        row = {
            "year": int(year),
            "countries_with_ppi": len(v),
            "mean_ppi": v.mean() if len(v) else np.nan,
            "ci_low": lo,
            "ci_high": hi,
            "median_ppi": np.median(v) if len(v) else np.nan,
            "countries_profiled": int(sub["profile"].notna().sum()),
        }
        for c in config.CLUSTER_CODES:
            row[f"share_{c}"] = float((sub["profile"] == c).sum() / max(1, sub["profile"].notna().sum()))
        rows.append(row)
        for var, label in OUTCOMES.items():
            ok = sub[["ppi", var]].dropna()
            if len(ok) < 20:
                continue
            r, p = stats.pearsonr(ok["ppi"], ok[var])
            lo_r, hi_r = fisher_ci(r, len(ok))
            cors.append(
                {
                    "year": int(year),
                    "outcome": label,
                    "r": r,
                    "ci_low": lo_r,
                    "ci_high": hi_r,
                    "p_value": p,
                    "n": len(ok),
                }
            )
    return pd.DataFrame(rows), pd.DataFrame(cors)


def within_trend(annual: pd.DataFrame, var: str = "ppi") -> dict:
    """Average within-country change per year: OLS of `var` on year with country fixed effects.

    Standard errors are clustered by country (CR1), so serial correlation within a
    country does not overstate precision.
    """
    d = annual[["iso3", "year", var]].dropna()
    d = d[d.groupby("iso3")["year"].transform("count") >= 5]
    y = d[var] - d.groupby("iso3")[var].transform("mean")
    x = d["year"] - d.groupby("iso3")["year"].transform("mean")
    beta = float((x * y).sum() / (x * x).sum())
    u = y - beta * x
    g = d["iso3"].to_numpy()
    scores = pd.Series((x * u).to_numpy(), index=g).groupby(level=0).sum()
    G, N, K = scores.size, len(d), 1 + d["iso3"].nunique()
    meat = float((scores**2).sum())
    se = np.sqrt(meat / (x * x).sum() ** 2 * G / (G - 1) * (N - 1) / (N - K))
    t = beta / se
    p = 2 * stats.t.sf(abs(t), df=G - 1)
    q = stats.t.ppf(0.975, df=G - 1)
    return {
        "measure": f"{var} per year (within country)",
        "estimate": beta,
        "ci_low": beta - q * se,
        "ci_high": beta + q * se,
        "se": se,
        "p_value": float(p),
        "countries": int(G),
        "observations": int(N),
        "method": "country fixed effects, SE clustered by country",
    }


def correlation_change(
    annual: pd.DataFrame,
    outcome: str,
    first: int,
    last: int,
    seed: int = config.RANDOM_STATE,
    n_boot: int = N_BOOT,
) -> dict:
    """Bootstrap CI for r(last) - r(first), resampling countries observed in both years."""
    a = annual[annual["year"] == first].set_index("iso3")[["ppi", outcome]].dropna()
    b = annual[annual["year"] == last].set_index("iso3")[["ppi", outcome]].dropna()
    common = a.index.intersection(b.index)
    a, b = a.loc[common].to_numpy(), b.loc[common].to_numpy()
    rng = np.random.default_rng(seed)
    diffs = []
    for _ in range(n_boot):
        i = rng.integers(0, len(common), len(common))
        diffs.append(np.corrcoef(b[i].T)[0, 1] - np.corrcoef(a[i].T)[0, 1])
    est = np.corrcoef(b.T)[0, 1] - np.corrcoef(a.T)[0, 1]
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    share = np.mean(np.array(diffs) >= 0) if est < 0 else np.mean(np.array(diffs) <= 0)
    return {
        "measure": f"change in r(PPI, {OUTCOMES[outcome]}) {first}→{last}",
        "estimate": float(est),
        "ci_low": float(lo),
        "ci_high": float(hi),
        "se": float(np.std(diffs, ddof=1)),
        "p_value": float(min(1.0, 2 * share)),
        "countries": int(len(common)),
        "observations": int(2 * len(common)),
        "method": f"paired country bootstrap, {n_boot} draws",
    }


def validation(annual: pd.DataFrame, periods: pd.DataFrame) -> dict:
    """How well averages of annual PPI reproduce the published period PPI."""
    per = {k: (a, b) for k, (a, b) in config.PERIODS.items()}
    rows = []
    for code, (a, b) in per.items():
        m = annual[annual["year"].between(a, b)].groupby("iso3")["ppi"].mean().rename("annual_mean")
        p = periods[periods["period"] == code].set_index("iso3")["ppi"].rename("period_ppi")
        rows.append(pd.concat([m, p], axis=1, join="inner").dropna())
    both = pd.concat(rows)
    r = float(np.corrcoef(both["annual_mean"], both["period_ppi"])[0, 1])
    mad = float((both["annual_mean"] - both["period_ppi"]).abs().mean())
    return {
        "measure": "r(mean of annual PPI, period PPI)",
        "estimate": r,
        "ci_low": np.nan,
        "ci_high": np.nan,
        "se": np.nan,
        "p_value": np.nan,
        "countries": int(both.index.nunique()),
        "observations": len(both),
        "method": f"country-periods; mean absolute difference {mad:.2f} PPI points",
    }


def build(sample: pd.DataFrame, periods: pd.DataFrame, model: ClusterModel) -> dict[str, pd.DataFrame]:
    annual = annual_ppi(sample, period_scale(periods))
    annual["profile"] = annual_profiles(annual, model)
    years, cors = yearly_stats(annual)
    tests = [
        within_trend(annual, "ppi"),
        within_trend(annual, "life_expectancy"),
        validation(annual, periods),
    ]
    # the change in each correlation between the first and last year with full coverage
    covered = years.loc[years["countries_with_ppi"] >= 150, "year"]
    y0, y1 = int(covered.min()), int(covered.max())
    tests += [
        correlation_change(annual, v, y0, y1)
        for v in ("life_expectancy", "log_gdp_pc", "infant_mortality")
    ]
    keep = [
        "iso3",
        "country",
        "year",
        "ppi",
        "ppi_n_indicators",
        "profile",
        "life_expectancy",
        "log_gdp_pc",
        "infant_mortality",
        "urban_population_pct",
        "population",
    ]
    return {
        "annual_ppi": annual[keep].round(4),
        "annual_summary": years.round(4),
        "annual_correlations": cors.round(4),
        "annual_tests": pd.DataFrame(tests).round(4),
    }
