"""Bivariate associations between the PPI and socio-economic outcomes."""

from __future__ import annotations

import pandas as pd
from scipy import stats

from . import config


def stars(p: float) -> str:
    return "***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "ns"


def ppi_regressions(df: pd.DataFrame, min_n: int = 20) -> pd.DataFrame:
    """OLS of each outcome on the PPI, separately for each period.

    These are bivariate associations with no controls; they describe how
    pressure and development co-vary, not causal effects.
    """
    rows = []
    for period in config.PERIODS:
        sub = df[df["period"] == period]
        for var, label in config.SE_LABELS.items():
            valid = sub[["ppi", var]].dropna()
            if len(valid) < min_n:
                continue
            fit = stats.linregress(valid["ppi"], valid[var])
            rows.append({
                "period": config.PERIOD_LABELS[period],
                "outcome": label,
                "r": fit.rvalue,
                "beta": fit.slope,
                "se": fit.stderr,
                "p_value": fit.pvalue,
                "sig": stars(fit.pvalue),
                "n": len(valid),
            })
    return pd.DataFrame(rows)
