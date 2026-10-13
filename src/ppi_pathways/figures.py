"""Figures. Every function takes analysis tables and writes one PNG."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from . import config  # noqa: E402

INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#e4e3df"
SURFACE = "#fcfcfb"
BLUES = ["#eef4fc", "#c6dbf5", "#8fb8ea", "#4f8fdc", "#2a78d6", "#1d5aa6"]

plt.rcParams.update({
    "figure.dpi": 150, "savefig.dpi": 200, "savefig.bbox": "tight",
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "font.size": 10, "axes.titlesize": 11, "axes.titleweight": "bold",
    "axes.labelcolor": INK_2, "xtick.color": INK_2, "ytick.color": INK_2,
    "axes.edgecolor": GRID, "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6,
    "axes.spines.top": False, "axes.spines.right": False, "legend.frameon": False,
})


def _save(fig, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path)
    plt.close(fig)
    return path


def k_diagnostics(diag: pd.DataFrame, chosen_k: int, path: Path) -> Path:
    """Elbow and silhouette as two panels (never a dual axis)."""
    fig, (a, b) = plt.subplots(1, 2, figsize=(9, 3.4))
    for ax, col, title in [(a, "inertia", "Within-cluster sum of squares"),
                           (b, "silhouette", "Silhouette score")]:
        ax.plot(diag["k"], diag[col], color=BLUES[4], lw=2, marker="o", ms=6)
        ax.axvline(chosen_k, color=INK_2, lw=1, ls=":")
        ax.set_title(title, loc="left")
        ax.set_xlabel("Number of clusters (K)")
        ax.set_xticks(diag["k"])
    b.annotate(f"K = {chosen_k} used", xy=(chosen_k, diag.set_index("k").loc[chosen_k, "silhouette"]),
               xytext=(8, 10), textcoords="offset points", color=INK_2, fontsize=9)
    fig.suptitle("Choosing K: pooled k-means on all country-periods", x=0.01, ha="left",
                 fontweight="bold", color=INK)
    fig.tight_layout()
    return _save(fig, path)


def ppi_by_period(df: pd.DataFrame, path: Path) -> Path:
    """Distribution of the PPI in each period on the common 0–100 scale."""
    fig, ax = plt.subplots(figsize=(7, 3.6))
    periods = list(config.PERIODS)
    data = [df.loc[df["period"] == p, "ppi"].dropna() for p in periods]
    rng = np.random.default_rng(config.RANDOM_STATE)
    for i, values in enumerate(data):
        ax.scatter(i + rng.uniform(-0.18, 0.18, len(values)), values, s=9,
                   color=BLUES[3], alpha=0.45, lw=0)
        ax.hlines(values.median(), i - 0.3, i + 0.3, color=INK, lw=2)
        ax.text(i + 0.33, values.median(), f"median {values.median():.1f}", va="center",
                fontsize=8.5, color=INK_2,
                bbox=dict(boxstyle="round,pad=0.2", fc=SURFACE, ec="none"))
    ax.set_xticks(range(len(periods)), [config.PERIOD_LABELS[p] for p in periods])
    ax.set_xlim(-0.6, len(periods) - 0.1)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Planetary Pressure Index (0–100)")
    ax.set_title("PPI by period: one dot per country", loc="left")
    ax.grid(axis="x", visible=False)
    return _save(fig, path)


def clusters_by_period(clustered: pd.DataFrame, labels: dict[str, str], path: Path) -> Path:
    """PPI against life expectancy, one panel per period, coloured and shaped by cluster."""
    periods = list(config.PERIODS)
    fig, axes = plt.subplots(1, len(periods), figsize=(12, 4), sharex=True, sharey=True)
    for ax, p in zip(axes, periods, strict=True):
        sub = clustered[clustered["period"] == p]
        for code in config.CLUSTER_CODES:
            pts = sub[sub["cluster"] == code]
            ax.scatter(pts["ppi"], pts["life_expectancy"], s=22, color=config.CLUSTER_COLORS[code],
                       marker=config.CLUSTER_MARKERS[code], edgecolor=SURFACE, lw=0.8,
                       label=f"{code}: {labels[code]}")
        ax.set_title(config.PERIOD_LABELS[p], loc="left")
        ax.set_xlabel("PPI (0–100)")
    axes[0].set_ylabel("Life expectancy (years)")
    handles, names = axes[0].get_legend_handles_labels()
    fig.legend(handles, names, loc="lower center", ncol=2, fontsize=9, bbox_to_anchor=(0.5, -0.1))
    fig.suptitle("Pressure–development clusters (one model fitted to all periods)", x=0.01,
                 ha="left", fontweight="bold", color=INK)
    fig.tight_layout()
    return _save(fig, path)


def transitions(matrices: dict[str, pd.DataFrame], path: Path) -> Path:
    """Transition matrices as annotated heatmaps (sequential blue)."""
    from matplotlib.colors import LinearSegmentedColormap

    cmap = LinearSegmentedColormap.from_list("blues", BLUES)
    vmax = max(m.values.max() for m in matrices.values())
    fig, axes = plt.subplots(1, len(matrices), figsize=(4.4 * len(matrices), 4))
    for ax, (title, m) in zip(np.atleast_1d(axes), matrices.items(), strict=True):
        ax.imshow(m.values, cmap=cmap, vmin=0, vmax=vmax)
        for i in range(m.shape[0]):
            for j in range(m.shape[1]):
                v = m.values[i, j]
                ax.text(j, i, v, ha="center", va="center", fontsize=10,
                        color="white" if v > vmax * 0.55 else INK)
        ax.set_xticks(range(m.shape[1]), m.columns)
        ax.set_yticks(range(m.shape[0]), m.index)
        ax.set_xlabel("To cluster")
        ax.set_ylabel("From cluster")
        ax.set_title(title, loc="left")
        ax.grid(False)
        for s in ax.spines.values():
            s.set_visible(False)
    fig.tight_layout()
    return _save(fig, path)


def regression_dots(reg: pd.DataFrame, path: Path) -> Path:
    """Correlation of each outcome with the PPI, by period (dot plot)."""
    outcomes = list(dict.fromkeys(reg["outcome"]))
    periods = list(dict.fromkeys(reg["period"]))
    shades = [BLUES[2], BLUES[4], BLUES[5]]
    markers = ["o", "s", "D"]
    fig, ax = plt.subplots(figsize=(7.5, 3.8))
    for k, (p, c, mk) in enumerate(zip(periods, shades, markers, strict=True)):
        sub = reg[reg["period"] == p].set_index("outcome").reindex(outcomes)
        y = np.arange(len(outcomes)) + (k - 1) * 0.22
        ax.scatter(sub["r"], y, color=c, marker=mk, s=36, edgecolor=SURFACE, lw=0.8, label=p, zorder=3)
    ax.axvline(0, color=INK_2, lw=1)
    ax.set_yticks(range(len(outcomes)), outcomes)
    ax.invert_yaxis()
    ax.set_xlim(-0.6, 0.6)
    ax.set_xlabel("Pearson r with the PPI")
    ax.set_title("How development outcomes co-vary with planetary pressure", loc="left")
    ax.legend(title="Period", loc="lower right", fontsize=8.5, title_fontsize=8.5)
    ax.grid(axis="y", visible=False)
    return _save(fig, path)
