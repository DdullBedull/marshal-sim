import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from marshal_sim.api import app

client = TestClient(app)
GPX = Path(__file__).parent.parent / "data" / "sample.gpx"

CONFIG = {
    "categories": [
        {"name": "4K", "distance_km": 4.0, "count": 300, "pace_mean": 6.0,
         "pace_std": 1.0, "start_spread_min": 3.0}
    ],
    "points": [{"name": "Persimpangan A", "km": 1.0, "type": "persimpangan"}],
}


def post(config, content=None):
    data = content if content is not None else GPX.read_bytes()
    return client.post(
        "/api/simulate",
        files={"gpx": ("sample.gpx", data, "application/gpx+xml")},
        data={"config": json.dumps(config)},
    )


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_simulate_ok():
    r = post(CONFIG)
    assert r.status_code == 200
    body = r.json()
    assert body["n_runners"] == 300
    assert body["route"]["length_km"] == pytest.approx(3.99, abs=0.02)
    assert body["recommendations"][0]["marshal"] >= 1
    assert len(body["sim"]["density"]) == len(body["sim"]["times_min"])


def test_invalid_gpx_returns_400():
    assert post(CONFIG, content=b"bukan gpx").status_code == 400


def test_invalid_config_returns_422():
    assert post({**CONFIG, "categories": []}).status_code == 422


def test_point_outside_route_returns_422():
    cfg = {**CONFIG, "points": [{"name": "X", "km": 99, "type": "lurus"}]}
    assert post(cfg).status_code == 422


def test_index_page_served():
    r = client.get("/")
    assert r.status_code == 200
    assert "Marshal" in r.text