import json

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from gpxpy.gpx import GPXException
from pydantic import ValidationError

from marshal_sim.points import SpecialPoint
from marshal_sim.recommend import recommend_posts
from marshal_sim.route import parse_gpx
from marshal_sim.runners import Category, generate_runners
from marshal_sim.schemas import SimConfig
from marshal_sim.simulate import simulate_density

app = FastAPI(title="Marshal Sim API")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/simulate")
def simulate(gpx: UploadFile = File(...), config: str = Form(...)):
    try:
        cfg = SimConfig.model_validate_json(config)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=json.loads(e.json()))

    try:
        route = parse_gpx(gpx.file.read().decode("utf-8"))
    except (UnicodeDecodeError, ValueError, GPXException) as e:
        raise HTTPException(status_code=400, detail=f"GPX tidak valid: {e}")

    cats = [Category(**c.model_dump()) for c in cfg.categories]
    runners = generate_runners(cats, seed=cfg.seed)
    result = simulate_density(route, runners, step_km=cfg.step_km, dt_min=cfg.dt_min)

    try:
        points = [SpecialPoint(**p.model_dump()) for p in cfg.points]
        recs = recommend_posts(result, points, capacity=cfg.capacity)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "n_runners": int(len(runners.pace)),
        "route": {
            "length_km": round(route.length_km, 3),
            "lat": route.lat.tolist(),
            "lon": route.lon.tolist(),
            "dist_km": np.round(route.dist_km, 4).tolist(),
        },
        "sim": {
            "step_km": result.step_km,
            "times_min": result.times_min.tolist(),
            "centers_km": np.round(result.centers_km, 4).tolist(),
            "density": np.round(result.density, 1).tolist(),
        },
        "recommendations": json.loads(recs.to_json(orient="records")),
        "total_marshal": int(recs["marshal"].sum()) if len(recs) else 0,
    }