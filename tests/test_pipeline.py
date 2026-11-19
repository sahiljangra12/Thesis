"""Checks that guard the analysis against the errors fixed in v2.0."""

import numpy as np
import pandas as pd
import pytest

from ppi_pathways import clustering, config, data, index, regression


@pytest.fixture(scope="module")
def panel():
    return data.load_panel()


@pytest.fixture(scope="module")
def sample(panel):
    return data.select_sample(panel, data.load_states())


@pytest.fixture(scope="module")
def periods(sample):
    return index.build_ppi(data.period_means(sample))


@pytest.fixture(scope="module")
def fitted(periods):
    return clustering.fit_clusters(periods)


# --- sample ---------------------------------------------------------------

def test_states_list_is_un_members_plus_palestine():
    states = data.load_states()
    assert len(states) == 194
    assert states["iso3"].is_unique
    assert (states["status"] == "UN member state").sum() == 193


def test_sample_excludes_aggregates_and_territories(sample):
    names = set(sample["country"])
    for bad in ["World", "Early-demographic dividend", "Post-demographic dividend",
                "Hong Kong SAR, China", "Puerto Rico (US)", "Guam", "Channel Islands"]:
        assert bad not in names


def test_sample_keeps_countries_a_keyword_filter_dropped(sample):
    assert "Trinidad and Tobago" in set(sample["country"])


def test_sample_size_and_population_rule(sample):
    assert sample["iso3"].nunique() == 182
    assert (sample.groupby("iso3")["population"].mean() >= config.MIN_POPULATION).all()


def test_periods_do_not_overlap():
    years = pd.Series(range(config.FIRST_YEAR, config.LAST_YEAR + 1))
    assigned = data.assign_period(years)
    assert assigned.notna().all()
    assert assigned.loc[years == 2000].item() == "D1"
    assert assigned.loc[years == 2010].item() == "D2"


# --- PPI ------------------------------------------------------------------

def test_ppi_uses_one_scale_for_all_periods(periods):
    ppi = periods["ppi"].dropna()
    assert ppi.min() == pytest.approx(0) and ppi.max() == pytest.approx(100)
    # with a pooled scale, not every period is forced to span exactly 0–100
    spans = periods.groupby("period", observed=True)["ppi"].agg(["min", "max"])
    assert not ((spans["min"] == 0) & (spans["max"] == 100)).all()


def test_ppi_direction(periods):
    """More forest and more renewables must mean lower pressure."""
    sub = periods.dropna(subset=["ppi"])
    assert sub["ppi"].corr(sub["forest_pct"]) < 0
    assert sub["ppi"].corr(sub["renewable_energy"]) < 0
    assert sub["ppi"].corr(sub["fertilizer"]) > 0


def test_ppi_requires_minimum_indicators(periods):
    assert periods.loc[periods["ppi_n_indicators"] < config.PPI_MIN_INDICATORS, "ppi"].isna().all()


# --- clusters -------------------------------------------------------------

def test_cluster_codes_are_unique_and_ordered_by_development(fitted):
    _, model = fitted
    assert sorted(model.label_map.values()) == config.CLUSTER_CODES
    gdp = model.centroids()["log_gdp_pc"]
    assert gdp.is_monotonic_increasing


def test_one_model_for_all_periods(fitted):
    clustered, model = fitted
    X = model.scaler.transform(clustered[config.CLUSTER_VARS])
    predicted = [model.label_map[i] for i in model.kmeans.predict(X)]
    assert predicted == clustered["cluster"].tolist()


def test_transition_matrix_counts(fitted):
    clustered, _ = fitted
    m = clustering.transition_matrix(clustered, "D1", "D2")
    in_both = set(clustered.loc[clustered["period"] == "D1", "iso3"]) & \
        set(clustered.loc[clustered["period"] == "D2", "iso3"])
    assert m.values.sum() == len(in_both)
    assert 0 <= clustering.persistence(m) <= 1


def test_clustering_is_deterministic(periods):
    a, _ = clustering.fit_clusters(periods)
    b, _ = clustering.fit_clusters(periods)
    assert a["cluster"].tolist() == b["cluster"].tolist()


# --- regression -----------------------------------------------------------

def test_gdp_regression_uses_log_gdp(periods):
    reg = regression.ppi_regressions(periods)
    gdp = reg[(reg["outcome"] == config.SE_LABELS["log_gdp_pc"]) & (reg["period"] == "1990–2000")]
    sub = periods[periods["period"] == "D1"][["ppi", "log_gdp_pc"]].dropna()
    assert gdp["r"].item() == pytest.approx(np.corrcoef(sub["ppi"], sub["log_gdp_pc"])[0, 1])


# --- year-by-year extension ----------------------------------------------

def test_annual_ppi_reproduces_period_ppi(sample, periods, fitted):
    from ppi_pathways import annual
    a = annual.annual_ppi(sample, annual.period_scale(periods))
    v = annual.validation(a, periods)
    assert v["estimate"] > 0.98


def test_annual_profiles_use_period_model(sample, periods, fitted):
    from ppi_pathways import annual
    _, model = fitted
    a = annual.annual_ppi(sample, annual.period_scale(periods))
    lab = annual.annual_profiles(a, model).dropna()
    assert set(lab.unique()) <= set(config.CLUSTER_CODES)
    assert len(lab) > 4000


def test_within_trend_recovers_known_slope_with_valid_intervals():
    from ppi_pathways import annual
    covered = 0
    for seed in range(100):
        rng = np.random.default_rng(seed)
        rows = [{"iso3": f"C{i}", "year": y, "ppi": 10 * i + 0.5 * (y - 2000) + rng.normal(0, 0.1)}
                for i in range(40) for y in range(1990, 2021)]
        t = annual.within_trend(pd.DataFrame(rows))
        assert abs(t["estimate"] - 0.5) < 0.01
        covered += t["ci_low"] < 0.5 < t["ci_high"]
    assert covered >= 90  # nominal 95% coverage


def test_fisher_interval_contains_estimate():
    from ppi_pathways import annual
    lo, hi = annual.fisher_ci(0.4, 177)
    assert lo < 0.4 < hi and round(lo, 2) == 0.27 and round(hi, 2) == 0.52
