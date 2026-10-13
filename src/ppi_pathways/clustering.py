"""Pressure–development clusters and transitions between periods."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from . import config


def complete_cases(df: pd.DataFrame) -> pd.DataFrame:
    return df.dropna(subset=config.CLUSTER_VARS)


def k_diagnostics(df: pd.DataFrame, k_range=config.K_RANGE) -> pd.DataFrame:
    """Inertia and silhouette for each K on the pooled, standardised data."""
    X = StandardScaler().fit_transform(complete_cases(df)[config.CLUSTER_VARS])
    rows = []
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=config.RANDOM_STATE, n_init=config.N_INIT).fit(X)
        rows.append({"k": k, "inertia": km.inertia_, "silhouette": silhouette_score(X, km.labels_)})
    return pd.DataFrame(rows)


@dataclass
class ClusterModel:
    scaler: StandardScaler
    kmeans: KMeans
    label_map: dict[int, str]
    silhouette: float

    def centroids(self) -> pd.DataFrame:
        """Cluster centres in original units."""
        centers = self.scaler.inverse_transform(self.kmeans.cluster_centers_)
        out = pd.DataFrame(centers, columns=config.CLUSTER_VARS)
        out.index = [self.label_map[i] for i in range(len(out))]
        return out.sort_index()

    def labels(self) -> dict[str, str]:
        """Descriptive name for each cluster, generated from its centre.

        Development tier comes from the C1..C4 ordering; pressure is described
        relative to the pooled mean PPI (standardised centre above or below 0).
        """
        centers_z = pd.DataFrame(self.kmeans.cluster_centers_, columns=config.CLUSTER_VARS)
        out = {}
        for cid, code in self.label_map.items():
            tier = config.DEVELOPMENT_TIERS[config.CLUSTER_CODES.index(code)]
            pressure = "higher" if centers_z.loc[cid, "ppi"] > 0 else "lower"
            out[code] = f"{tier} development, {pressure} pressure"
        return dict(sorted(out.items()))


def development_score(centers_z: np.ndarray) -> np.ndarray:
    """Mean of the standardised development variables (infant mortality reversed)."""
    idx = {v: i for i, v in enumerate(config.CLUSTER_VARS)}
    return np.mean([
        centers_z[:, idx["log_gdp_pc"]],
        centers_z[:, idx["life_expectancy"]],
        -centers_z[:, idx["infant_mortality"]],
        centers_z[:, idx["urban_population_pct"]],
    ], axis=0)


def name_clusters(centers_z: np.ndarray) -> dict[int, str]:
    """Map k-means cluster ids to codes C1..Ck ordered by development score."""
    order = np.argsort(development_score(centers_z))
    return {int(cid): config.CLUSTER_CODES[rank] for rank, cid in enumerate(order)}


def fit_clusters(df: pd.DataFrame, k: int = config.K) -> tuple[pd.DataFrame, ClusterModel]:
    """Fit one k-means model on all country-periods together and label every row.

    Because the centres are shared across periods, a change of cluster between
    periods means the country's indicators moved, not that the labels moved.
    """
    data = complete_cases(df).copy()
    scaler = StandardScaler().fit(data[config.CLUSTER_VARS])
    X = scaler.transform(data[config.CLUSTER_VARS])
    km = KMeans(n_clusters=k, random_state=config.RANDOM_STATE, n_init=config.N_INIT).fit(X)
    label_map = name_clusters(km.cluster_centers_)
    data["cluster"] = [label_map[i] for i in km.labels_]
    model = ClusterModel(scaler, km, label_map, float(silhouette_score(X, km.labels_)))
    return data, model


def transition_matrix(clustered: pd.DataFrame, origin: str, destination: str) -> pd.DataFrame:
    """Counts of countries moving from each cluster in `origin` to each in `destination`."""
    a = clustered[clustered["period"] == origin].set_index("iso3")["cluster"]
    b = clustered[clustered["period"] == destination].set_index("iso3")["cluster"]
    both = pd.concat([a.rename("from"), b.rename("to")], axis=1, join="inner")
    order = config.CLUSTER_CODES
    return pd.crosstab(both["from"], both["to"]).reindex(index=order, columns=order, fill_value=0)


def persistence(matrix: pd.DataFrame) -> float:
    """Share of countries that stay in the same cluster."""
    return float(np.trace(matrix.values) / matrix.values.sum())
