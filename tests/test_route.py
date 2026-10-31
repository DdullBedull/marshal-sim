from pathlib import Path

import pytest

from marshal_sim.route import load_gpx

GPX = Path(__file__).parent.parent / "data" / "sample.gpx"


def test_load_sample_gpx():
    route = load_gpx(GPX)
    assert len(route.lat) == 5
    assert route.length_km == pytest.approx(3.99, abs=0.02)


def test_distance_starts_at_zero_and_increases():
    route = load_gpx(GPX)
    assert route.dist_km[0] == 0
    assert all(b > a for a, b in zip(route.dist_km, route.dist_km[1:]))