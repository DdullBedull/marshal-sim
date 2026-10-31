import math

import numpy as np
import pandas as pd

from marshal_sim.simulate import SimResult


def recommend_posts(result: SimResult, points, capacity=1500.0) -> pd.DataFrame:
    """Rekomendasi jumlah marshal tiap titik khusus.

    skor    = kepadatan puncak x bobot tipe titik
    marshal = ceil(skor / capacity), minimal 1 kalau ada pelari yang lewat
    """
    n_bins = result.density.shape[1]
    dt = float(result.times_min[1] - result.times_min[0])
    rows = []

    for p in points:
        b = math.floor(p.km / result.step_km)
        if not 0 <= b < n_bins:
            raise ValueError(f"titik '{p.name}' (km {p.km}) di luar panjang rute")

        series = result.density[:, b]
        active = np.flatnonzero(series > 0)
        peak = float(series.max())
        score = peak * p.weight

        if active.size == 0:
            # tidak ada pelari yang lewat, pos tidak dibutuhkan
            first = last = peak_t = float("nan")
            active_min = 0.0
            marshals = 0
        else:
            first = float(result.times_min[active[0]])
            last = float(result.times_min[active[-1]])
            peak_t = float(result.times_min[series.argmax()])
            active_min = last - first + dt
            marshals = max(1, math.ceil(score / capacity))

        rows.append(
            {
                "pos": p.name,
                "tipe": p.type,
                "km": p.km,
                "puncak": round(peak),
                "menit_puncak": peak_t,
                "mulai": first,
                "selesai": last,
                "aktif_min": active_min,
                "skor": round(score),
                "marshal": marshals,
            }
        )

    return pd.DataFrame(rows)