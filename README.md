<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/header-thesis-dark.svg">
  <img src="docs/header-thesis-light.svg" alt="Planetary Boundaries and Development: ecological pressure and development across 182 countries, 1990–2023" width="100%">
</picture>

[![CI](https://github.com/sahiljangra12/Thesis/actions/workflows/ci.yml/badge.svg)](https://github.com/sahiljangra12/Thesis/actions/workflows/ci.yml)

**Planetary Boundary Transgressions and Divergent Socio-Economic Pathways: A Cross-National Quantitative Analysis**<br>
Undergraduate thesis, BSc Analytics and Sustainability Studies, Tata Institute of Social Sciences, Mumbai (2026)<br>
Author: Sahil · Supervisor: Dr. Kamal Kumar Murari

<a href="https://sahiljangra12.github.io/Thesis/"><img src="docs/assets/img/site-preview.jpg" alt="Study site: Earth from orbit with the title Development. At what planetary cost?" width="100%"></a>

**[Open the interactive study site →](https://sahiljangra12.github.io/Thesis/)** An illustrated essay on the results: satellite plates for the six pressures, a beeswarm of the index by period, pressure fingerprints for every country, an alluvial of profile moves, and a world map. · [Full explorer](https://sahiljangra12.github.io/Thesis/explorer.html) · [Original chart](https://sahiljangra12.github.io/Thesis/ppi-chart.html) · [Method changes in v2.0](docs/method-changes.md) · [Results tables](results/)

## Research question

Do countries that place more pressure on planetary boundaries achieve better socio-economic outcomes, and how have countries moved between pressure–development pathways since 1990?

## Data

The sample is **182 countries**: the 193 UN member states plus the State of Palestine, keeping those with a mean population of at least 100,000. The panel runs from 1990 to 2023, and its indicators come from the World Bank World Development Indicators, FAOSTAT, the WHO Global Health Observatory, ILOSTAT and the UNDP Human Development Report. Years are grouped into three non-overlapping periods: 1990–2000, 2001–2010 and 2011–2023.

See [`data/README.md`](data/README.md) for files, variables and provenance.

## Method

1. **Planetary Pressure Index (PPI).** Six indicators: renewable energy share and forest cover (both reversed), agricultural land, fertiliser use, PM2.5 exposure and energy use per capita. Each is z-scored over all country-periods, the six are averaged (at least 4 must be present), and the result is rescaled to a single 0–100 scale shared by every period.
2. **Clusters.** One k-means model (K = 4) is fitted to all country-periods together. It uses PPI, log GDP per capita, life expectancy, infant mortality and urbanisation. Clusters are numbered by development level and named from their centres.
3. **Transitions.** For each pair of consecutive periods, the analysis counts how many countries moved from one cluster to another. Because the clusters are shared, a move reflects a real change in the country's indicators.
4. **Associations.** Bivariate OLS of each outcome on the PPI, by period. These describe co-variation, not causal effects.

## Key results

| Cluster | Description | PPI | Life expectancy | GDP per capita |
|---|---|---|---|---|
| C1 | Low development, lower pressure | 30 | 53 yrs | ~$500 |
| C2 | Lower-middle development, lower pressure | 27 | 65 yrs | ~$1,250 |
| C3 | Upper-middle development, higher pressure | 37 | 71 yrs | ~$4,000 |
| C4 | High development, higher pressure | 44 | 78 yrs | ~$25,000 |

*Cluster centres. GDP per capita is the exponential of the mean log value.*

![Clusters by period](figures/fig3_clusters_by_period.png)

- **Development and pressure rise together.** In every period, a higher PPI goes with higher income, longer life expectancy, lower infant mortality and more urbanisation (all p < 0.05). In decade averages the correlation with life expectancy moves from 0.40 in 1990–2000 to 0.25 in 2011–2023, but the year-by-year test below finds no statistically significant weakening.
- **Female labour-force participation runs the other way.** It is consistently lower where the PPI is higher (r ≈ −0.34 to −0.37). The PPI has no association with unemployment.
- **Countries move up, and pressure follows.** About 70% of countries stay in the same cluster from one period to the next. Almost every move is upward (48 of 49 moves from the 1990s to the 2000s, and all 53 from the 2000s to 2011–2023). The step from C2 to C3, the most common move from lower- to higher-pressure development, happened 36 times.
- **Global average pressure is roughly flat.** The mean PPI is 35.2, 35.0 and 35.6 across the three periods.
- **Silhouette is about 0.25 at K = 4.** The clusters overlap, so they should be read as a typology rather than sharply separated groups.

### Year by year (with uncertainty)

Every country-year from 1990 to 2023 is placed on the same pooled PPI scale and assigned to the nearest published cluster centre (`src/ppi_pathways/annual.py`; tables `results/csv/annual_*.csv`). Nothing is re-estimated, and averages of the annual PPI reproduce the period PPI (r = 0.996, mean absolute difference 0.52 points).

| Test | Estimate | 95% CI | p | Verdict |
|---|---|---|---|---|
| Within-country PPI trend (country fixed effects, SE clustered by country; 182 countries) | +0.018 points/yr | −0.030 to 0.066 | 0.46 | no detectable change |
| Within-country life-expectancy trend (same model) | +0.284 years/yr | 0.258 to 0.311 | < 0.001 | significant rise |
| Change in r(PPI, life expectancy), 1990 → 2022 (paired country bootstrap, 150 countries) | −0.039 | −0.153 to 0.069 | 0.47 | not significant |
| Change in r(PPI, log GDP per capita), 1990 → 2022 | −0.089 | −0.194 to 0.003 | 0.06 | not significant |
| Change in r(PPI, infant mortality), 1990 → 2022 | +0.071 | −0.043 to 0.190 | 0.21 | not significant |

Yearly means carry 95% country-bootstrap intervals and yearly correlations 95% Fisher-z intervals. 2023 has partial coverage (70 countries with a PPI) and is flagged wherever it appears.

### Latest data (provisional)

A weekly GitHub Actions job ([`live-data.yml`](.github/workflows/live-data.yml)) runs [`tools/fetch_live.py`](tools/fetch_live.py): it downloads the newest World Bank WDI values and applies the published scale and cluster centres ([`docs/data/ppi_scale.json`](docs/data/ppi_scale.json)) to write `docs/data/live.json`. It reports its agreement with the thesis data for overlapping years. The live layer is shown on the study site as hollow, labelled points and never changes the results above.

| Transitions between periods | PPI and development outcomes |
|---|---|
| ![Transition matrices](figures/fig4_transitions.png) | ![Correlations with the PPI](figures/fig5_ppi_correlations.png) |

All tables are in [`results/`](results/): the workbook `thesis_results.xlsx`, plus one CSV per table in `results/csv/`.

## Changes from the thesis version

Version 2.0 corrects several problems in the analysis as it appeared in the 2026 undergraduate thesis. These include aggregates and territories that had entered the sample, a per-period PPI scale, and clusters that were fitted separately for each period. The thesis version is preserved on the branch [`v1.0-thesis`](https://github.com/sahiljangra12/Thesis/tree/v1.0-thesis). What changed and why is documented in [`docs/method-changes.md`](docs/method-changes.md).

## Repository structure

```
src/ppi_pathways/    Analysis package: data, PPI, clustering, regression, figures, pipeline
notebooks/           thesis_analysis.ipynb: step-by-step walkthrough using the package
tests/               Checks on the sample, the PPI, the clusters and the regressions
data/                Input panel, country list, region lookup, source documentation
results/             Generated tables (xlsx + csv)
figures/             Generated figures
docs/                Study site (GitHub Pages), its data files and method notes
tools/               fetch_live.py: weekly provisional update from the World Bank API
```

## Reproducing the analysis

```bash
git clone https://github.com/sahiljangra12/Thesis.git
cd Thesis
pip install -e ".[dev]"
python -m ppi_pathways        # regenerates results/, figures/ and docs/data/ in a few seconds
pytest                        # runs the checks
```

On every push, continuous integration runs the linter and the tests. It then reruns the whole analysis and fails if any committed result changes.

## Citation

Use **"Cite this repository"** in the GitHub sidebar, or the details in [`CITATION.cff`](CITATION.cff).

## License

Code is released under the [MIT License](LICENSE). The data comes from the public sources listed above and remains subject to their terms.
