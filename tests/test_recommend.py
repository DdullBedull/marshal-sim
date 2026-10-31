import numpy as np
import pytest

from marshal_sim.points import SpecialPoint
from marshal_sim.recommend import recommend_posts
from marshal_sim.simulate import SimResult


def make_result(density):
    n_bins = density.shape[1]
    return SimResult(
        times_min=np.arange(density.shape[0], dtype=float),
        centers_km=np.arange(n_bins) * 0.1 + 0.05,
        density=density,
        step_km=0.1,
    )


def test_marshal_count_and_active_window():
    d = np.zeros((5, 10))
    d[1, 5], d[2, 5], d[3, 5] = 1000, 3000, 500
    res = make_result(d)
    df = recommend_posts(res, [SpecialPoint("P", 0.55, "persimpangan")], capacity=1500)
    row = df.iloc[0]
    assert row["skor"] == 9000      # 3000 x bobot 3
    assert row["marshal"] == 6      # ceil(9000 / 1500)
    assert row["menit_puncak"] == 2
    assert row["mulai"] == 1 and row["selesai"] == 3
    assert row["aktif_min"] == 3


def test_point_without_runners_needs_no_marshal():
    res = make_result(np.zeros((5, 10)))
    df = recommend_posts(res, [SpecialPoint("P", 0.55, "putar_balik")])
    assert df.iloc[0]["marshal"] == 0


def test_point_outside_route_raises():
    res = make_result(np.zeros((5, 10)))
    with pytest.raises(ValueError):
        recommend_posts(res, [SpecialPoint("P", 5.0, "lurus")])


def test_unknown_point_type_raises():
    with pytest.raises(ValueError):
        SpecialPoint("P", 1.0, "salah")