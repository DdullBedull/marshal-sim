from dataclasses import dataclass

import numpy as np

from marshal_sim.route import Route
from marshal_sim.runners import Runners


@dataclass
class SimResult:
    times_min: np.ndarray    # sumbu waktu (menit)
    centers_km: np.ndarray   # titik tengah tiap bin di sepanjang rute
    density: np.ndarray      # shape (waktu, bin), satuan pelari per km
    step_km: float


def simulate_density(route: Route, runners: Runners, step_km=0.1, dt_min=1.0) -> SimResult:
    length = route.length_km
    limit = np.minimum(runners.limit_km, length)

    t_max = float(np.max(runners.start_min + runners.pace * limit)) + dt_min
    times = np.arange(0, t_max + dt_min, dt_min)

    n_bins = int(np.ceil(length / step_km))
    edges = np.arange(n_bins + 1) * step_km
    centers = (edges[:-1] + edges[1:]) / 2

    density = np.zeros((len(times), n_bins))
    for i, t in enumerate(times):
        x = (t - runners.start_min) / runners.pace   # posisi tiap pelari (km)
        on_course = (x >= 0) & (x < limit)
        counts, _ = np.histogram(x[on_course], bins=edges)
        density[i] = counts / step_km

    return SimResult(times_min=times, centers_km=centers, density=density, step_km=step_km)