"""Constants shared across the analysis. Change parameters here, not in the modules."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
RESULTS_DIR = ROOT / "results"
FIGURES_DIR = ROOT / "figures"
DOCS_DATA_DIR = ROOT / "docs" / "data"

PANEL_FILE = DATA_DIR / "thesis_dataset.xlsx"
PANEL_SHEET = "Data"
STATES_FILE = DATA_DIR / "sovereign_states.csv"

# Sample definition
FIRST_YEAR, LAST_YEAR = 1990, 2023
MIN_POPULATION = 100_000  # mean population over the study period

# Periods are non-overlapping: each year belongs to exactly one period.
PERIODS = {
    "D1": (1990, 2000),
    "D2": (2001, 2010),
    "D3": (2011, 2023),
}
PERIOD_LABELS = {k: f"{a}–{b}" for k, (a, b) in PERIODS.items()}

# Planetary Pressure Index
PPI_VARS = ["renewable_energy", "forest_pct", "agri_land", "fertilizer", "pm25", "energy_use_pc"]
PPI_INVERSE = ["renewable_energy", "forest_pct"]  # higher value = less pressure
PPI_MIN_INDICATORS = 4

# Socio-economic outcomes
SE_VARS = ["gdp_pc", "life_expectancy", "infant_mortality", "urban_population_pct",
           "unemployment", "female_labor"]
SE_LABELS = {
    "log_gdp_pc": "GDP per capita (log)",
    "life_expectancy": "Life expectancy (years)",
    "infant_mortality": "Infant mortality (per 1,000)",
    "urban_population_pct": "Urbanisation (%)",
    "unemployment": "Unemployment (%)",
    "female_labor": "Female labour participation (%)",
}

# Clustering
CLUSTER_VARS = ["ppi", "log_gdp_pc", "life_expectancy", "infant_mortality", "urban_population_pct"]
K_RANGE = range(2, 9)
K = 4
RANDOM_STATE = 42
N_INIT = 50

# Clusters are numbered by development level (C1 = lowest, C4 = highest), which is
# the dominant axis in the data. Names are generated from the fitted centroids
# (see ClusterModel.labels), never assumed in advance.
CLUSTER_CODES = ["C1", "C2", "C3", "C4"]
DEVELOPMENT_TIERS = ["Low", "Lower-middle", "Upper-middle", "High"]
# Validated with the dataviz palette checker (all pairs, light mode); markers are the
# secondary encoding so clusters never rely on colour alone.
CLUSTER_COLORS = {"C1": "#e34948", "C2": "#eda100", "C3": "#1baf7a", "C4": "#2a78d6"}
CLUSTER_MARKERS = {"C1": "o", "C2": "s", "C3": "^", "C4": "D"}
