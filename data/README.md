# Data

| File | Contents |
|------|----------|
| `thesis_dataset.xlsx` | Country-year panel, 1990–2024, 50 indicators. The `Data` sheet holds the values and the `Legend` sheet holds the variable definitions. It also contains World Bank aggregate rows (regions, income groups); the analysis removes these. |
| `data_sources.xlsx` | Source and download link for each indicator, how each indicator maps to the planetary-boundary framework, and the master database the panel was compiled from |
| `sovereign_states.csv` | ISO3 codes of the 193 UN member states and the State of Palestine (UN observer state). This list defines the sample. |
| `country_regions.csv` | UN M49 sub-region for each state, generated with the `country_converter` package and used only for the interactive chart's tooltips |

## Variables used in the analysis

| Role | Variable | Definition |
|------|----------|------------|
| PPI | `renewable_energy` | Renewable energy share of total energy consumption (%), reversed |
| PPI | `forest_pct` | Forest area (% of land area), reversed |
| PPI | `agri_land` | Agricultural land (% of land area) |
| PPI | `fertilizer` | Fertiliser consumption (kg per hectare of arable land) |
| PPI | `pm25` | Mean annual PM2.5 exposure (µg/m³) |
| PPI | `energy_use_pc` | Energy use per capita (kg of oil equivalent) |
| Outcome | `gdp_pc` | GDP per capita (current US$), used in logs |
| Outcome | `life_expectancy` | Life expectancy at birth (years) |
| Outcome | `infant_mortality` | Infant mortality (per 1,000 live births) |
| Outcome | `urban_population_pct` | Urban population (% of total) |
| Outcome | `unemployment` | Unemployment (% of labour force) |
| Outcome | `female_labor` | Female labour-force participation (%) |
| Sample | `population` | Total population. Countries must have a mean of at least 100,000 over 1990–2023. |

## Sources

World Bank World Development Indicators, FAOSTAT, WHO Global Health Observatory, ILO ILOSTAT and the UNDP Human Development Report. All are open access; links to each series are in `data_sources.xlsx`.
