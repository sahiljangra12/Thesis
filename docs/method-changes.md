# Method changes: v1.0 (thesis) → v2.0

Version 1.0 is the analysis as it appeared in the 2026 undergraduate thesis, preserved on the branch `v1.0-thesis`. Version 2.0 fixes the problems below. Each fix is covered by a test in `tests/test_pipeline.py`, so the problem cannot come back unnoticed.

## 1. Sample

**v1.** Countries were selected by checking names against keywords such as "region", "world" and "ida". Any entry with a mean population of at least 100,000 was kept and described as "195 sovereign countries".

**Problems**
- Four World Bank aggregates passed the filter and were analysed as if they were countries: *Early-demographic dividend*, *Late-demographic dividend*, *Post-demographic dividend* and *Pre-demographic dividend*.
- Ten entities that are neither UN member states nor UN observer states were included: Channel Islands, Curaçao, French Polynesia, Guam, Hong Kong, Kosovo, Macao, New Caledonia, Puerto Rico and the US Virgin Islands.
- Trinidad and Tobago was wrongly removed, because "Trin**ida**d" contains the keyword "ida".
- The total of 195 was a coincidence of these errors, not the number of sovereign states.

**v2.** Countries are matched by ISO3 code against `data/sovereign_states.csv`, which lists the 193 UN member states plus the State of Palestine (recorded as "West Bank and Gaza" in the World Bank data). The population rule is unchanged. The result is **182 countries**: 195, minus the 4 aggregates and 10 non-member entities, plus Trinidad and Tobago.

## 2. Periods

**v1.** The periods were labelled 1990–2000, 2000–2010 and 2010–2023, which suggests that 2000 and 2010 each belong to two periods. In the code, the periods actually covered 1990–2000, 2001–2010 and 2011–2023.

**v2.** The labels now match the code: 1990–2000, 2001–2010 and 2011–2023.

## 3. PPI scale

**v1.** The z-scores were pooled across periods, but the final 0–100 rescaling was done separately in each period. Every period was therefore stretched to run from 0 to 100, so a given PPI value meant something different in each period. The reported rise in mean PPI (34.9 → 37.6 → 39.9) came from this rescaling, not from a change in pressure.

**v2.** One pooled rescaling is used for all periods. The mean PPI is roughly flat: 35.2, 35.0 and 35.6.

## 4. Clustering and transitions

**v1.** A separate k-means model was fitted in each period. Clusters were then named by comparing their centres with that period's median PPI and GDP, and a fallback rule renamed clusters whenever two received the same name. A country could therefore "change cluster" without its indicators changing at all. This produced the implausible 2000s → 2010s matrix, in which 63 of 64 "high pressure / low development" countries became "transitioning" and 36 "low pressure / low development" countries became "high pressure / low development". Only 37% of countries stayed in the same cluster.

**v2.**
- One k-means model is fitted to all country-periods together. The centres are shared, so a change of cluster now reflects a real change in the country's indicators.
- GDP per capita enters the clustering in logs, because the raw values are heavily skewed and would otherwise dominate the distances.
- Clusters are numbered by development level and named from their fitted centres, so no names are assumed in advance.
- The four-quadrant typology of v1 (high or low pressure crossed with high or low development) is not supported by the data. The clusters instead form a development gradient along which pressure rises.
- About 70% of countries stay in the same cluster between periods, and almost every move is upward.
- Silhouette scores are now reported for the pooled model (0.25 at K = 4). K = 2 has the highest silhouette, and this is stated rather than hidden.

## 5. GDP regression

**v1.** The table labelled the GDP outcome "GDP per capita (log)", but the regression used raw GDP per capita.

**v2.** The regression now uses log GDP per capita, matching the label. All other regressions use the same specification as before. Their results change only slightly, through the corrected sample and the corrected PPI scale.

## 6. Interactive chart

**v1.** The chart embedded a separate, hand-built extract covering 114 countries. Its cluster labels did not match the analysis.

**v2.** The chart reads `docs/data/ppi_animation.json`, which the pipeline writes. The chart now always shows the current results for all clustered countries.

## Summary of headline numbers

| | v1.0 (thesis) | v2.0 |
|---|---|---|
| Countries | 195 (incl. 4 aggregates and 10 non-member entities) | 182 |
| Mean PPI by period | 34.9 / 37.6 / 39.9 | 35.2 / 35.0 / 35.6 |
| Silhouette (K = 4) | 0.31 / 0.31 / 0.33 (separate models) | 0.25 (one pooled model) |
| Countries staying in the same cluster | 91% / 37% | 72% / 70% |
| PPI–life expectancy r by period | 0.40 / 0.37 / 0.25 | 0.40 / 0.36 / 0.25 |
| PPI–female labour participation r by period | −0.35 / −0.37 / −0.34 | −0.35 / −0.37 / −0.34 |
