"""Planetary Pressure Index (PPI)."""

from __future__ import annotations

import pandas as pd

from . import config


def build_ppi(df: pd.DataFrame) -> pd.DataFrame:
    """Add a 0–100 Planetary Pressure Index to a country-period table.

    1. Code each indicator so that higher always means more pressure.
    2. z-score each indicator over the pooled country-period observations.
    3. Average the z-scores; require at least PPI_MIN_INDICATORS of the six.
    4. Rescale to 0–100 using the pooled minimum and maximum.

    Every step uses pooled statistics, so a PPI of 40 means the same level of
    pressure in every period and changes over time are real changes.
    """
    out = df.copy()
    z = pd.DataFrame(index=out.index)
    for var in config.PPI_VARS:
        coded = -out[var] if var in config.PPI_INVERSE else out[var]
        z[var] = (coded - coded.mean()) / coded.std()

    out["ppi_n_indicators"] = z.notna().sum(axis=1)
    raw = z.mean(axis=1).where(out["ppi_n_indicators"] >= config.PPI_MIN_INDICATORS)
    out["ppi_raw"] = raw
    out["ppi"] = (raw - raw.min()) / (raw.max() - raw.min()) * 100
    return out
