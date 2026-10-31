from dataclasses import dataclass

import numpy as np


@dataclass
class Category:
    name: str
    distance_km: float          # jarak kategori, misal 5 atau 10
    count: int                  # jumlah peserta
    pace_mean: float            # rata-rata pace, menit per km
    pace_std: float             # simpangan baku pace
    start_offset_min: float = 0.0   # waktu start gelombang (wave), menit
    start_spread_min: float = 1.0   # lama peserta melewati garis start


@dataclass
class Runners:
    start_min: np.ndarray   # waktu tiap pelari melewati garis start
    pace: np.ndarray        # menit per km
    limit_km: np.ndarray    # jarak yang ditempuh tiap pelari


def generate_runners(categories, seed=42, min_pace=3.0) -> Runners:
    rng = np.random.default_rng(seed)
    starts, paces, limits = [], [], []
    for c in categories:
        pace = np.clip(rng.normal(c.pace_mean, c.pace_std, c.count), min_pace, None)
        start = c.start_offset_min + rng.uniform(0, c.start_spread_min, c.count)
        starts.append(start)
        paces.append(pace)
        limits.append(np.full(c.count, c.distance_km))
    return Runners(
        start_min=np.concatenate(starts),
        pace=np.concatenate(paces),
        limit_km=np.concatenate(limits),
    )