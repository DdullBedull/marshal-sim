from pathlib import Path

import numpy as np
import pytest

from marshal_sim.route import load_gpx
from marshal_sim.runners import Category, generate_runners
from marshal_sim.simulate import simulate_density

GPX = Path(__file__).parent.parent / "data" / "sample.gpx"


def make_cat(**kw):
    base = dict(
        name="T", distance_km=4.0, count=200, pace_mean=6.0, pace_std=0.0,
        start_offset_min=0.0, start_spread_min=0.0,
    )
    base.update(kw)
    return Category(**base)


def test_same_seed_same_runners():
    cats = [make_cat(pace_std=1.0, start_spread_min=2.0)]
    a = generate_runners(cats, seed=1)
    b = generate_runners(cats, seed=1)
    np.testing.assert_array_equal(a.pace, b.pace)
    np.testing.assert_array_equal(a.start_min, b.start_min)


def test_pace_never_below_min():
    cats = [make_cat(pace_mean=4.0, pace_std=2.0, count=500)]
    r = generate_runners(cats, seed=1)
    assert r.pace.min() >= 3.0


def test_runner_count_conserved_while_on_course():
    route = load_gpx(GPX)
    r = generate_runners([make_cat()], seed=1)
    res = simulate_density(route, r)
    total = res.density[5].sum() * res.step_km
    assert total == pytest.approx(200)


def test_runners_not_counted_before_start():
    route = load_gpx(GPX)
    r = generate_runners([make_cat(start_offset_min=10.0)], seed=1)
    res = simulate_density(route, r)
    assert res.density[5].sum() == 0


def test_finished_runners_not_counted():
    route = load_gpx(GPX)
    r = generate_runners([make_cat()], seed=1)
    res = simulate_density(route, r)
    assert res.density[-1].sum() == 0