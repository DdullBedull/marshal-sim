import math

import matplotlib.pyplot as plt

from marshal_sim.simulate import SimResult


def plot_density_timeseries(result: SimResult, points, path: str) -> None:
    """Kepadatan vs waktu, satu garis per pos."""
    fig, ax = plt.subplots(figsize=(9, 4.5))
    for p in points:
        b = math.floor(p.km / result.step_km)
        ax.plot(result.times_min, result.density[:, b], label=f"{p.name} (km {p.km:g})")
    ax.set_xlabel("Waktu sejak start (menit)")
    ax.set_ylabel("Kepadatan (pelari/km)")
    ax.set_title("Kepadatan pelari per pos")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def plot_heatmap(result: SimResult, points, path: str) -> None:
    """Heatmap: sumbu x = km rute, sumbu y = waktu."""
    length = result.centers_km[-1] + result.step_km / 2
    t_end = result.times_min[-1]

    fig, ax = plt.subplots(figsize=(9, 5))
    im = ax.imshow(
        result.density,
        aspect="auto",
        origin="lower",
        extent=[0, length, result.times_min[0], t_end],
        cmap="inferno",
    )
    for p in points:
        ax.axvline(p.km, color="white", linestyle="--", linewidth=0.8)
        ax.text(p.km, t_end, p.name, color="white", rotation=90,
                va="top", ha="right", fontsize=8)
    ax.set_xlabel("Jarak dari start (km)")
    ax.set_ylabel("Waktu sejak start (menit)")
    ax.set_title("Heatmap kepadatan pelari")
    fig.colorbar(im, ax=ax, label="pelari/km")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)