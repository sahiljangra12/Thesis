"""Load the country-year panel and build the country-period analysis table."""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config


def load_panel(path=config.PANEL_FILE, sheet=config.PANEL_SHEET) -> pd.DataFrame:
    """Read the raw country-year panel."""
    df = pd.read_excel(path, sheet_name=sheet)
    df.columns = [c.replace("★ ", "").strip() for c in df.columns]
    return df


def load_states(path=config.STATES_FILE) -> pd.DataFrame:
    """ISO3 codes of the 193 UN member states plus the State of Palestine."""
    return pd.read_csv(path)


def assign_period(year: pd.Series) -> pd.Series:
    """Map each year to its period code (D1, D2, D3); years outside all periods get NaN."""
    out = pd.Series(pd.NA, index=year.index, dtype="object")
    for code, (start, end) in config.PERIODS.items():
        out[(year >= start) & (year <= end)] = code
    return out


def select_sample(panel: pd.DataFrame, states: pd.DataFrame) -> pd.DataFrame:
    """Keep sovereign states in the study window with mean population >= MIN_POPULATION.

    Countries are matched on ISO3 code rather than name keywords, so World Bank
    aggregates (regions, income groups, demographic-dividend groups) and
    dependent territories can never enter the sample.
    """
    df = panel[panel["iso3"].isin(states["iso3"])]
    df = df[df["year"].between(config.FIRST_YEAR, config.LAST_YEAR)].copy()
    mean_pop = df.groupby("iso3")["population"].mean()
    keep = mean_pop[mean_pop >= config.MIN_POPULATION].index
    df = df[df["iso3"].isin(keep)].copy()
    df["period"] = assign_period(df["year"])
    return df


def period_means(sample: pd.DataFrame) -> pd.DataFrame:
    """Average each country's indicators within each period (one row per country-period)."""
    cols = sorted(set(config.PPI_VARS + config.SE_VARS + ["population"]))
    out = (sample.groupby(["iso3", "country", "period"])[cols]
           .mean()
           .reset_index())
    gdp = out["gdp_pc"].where(out["gdp_pc"] > 0)
    out["log_gdp_pc"] = np.log(gdp)
    out["period"] = pd.Categorical(out["period"], categories=list(config.PERIODS), ordered=True)
    return out.sort_values(["period", "iso3"]).reset_index(drop=True)
