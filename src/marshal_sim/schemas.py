from typing import Literal

from pydantic import BaseModel, Field


class CategoryIn(BaseModel):
    name: str
    distance_km: float = Field(gt=0)
    count: int = Field(gt=0, le=20000)
    pace_mean: float = Field(gt=0)
    pace_std: float = Field(ge=0)
    start_offset_min: float = Field(default=0.0, ge=0)
    start_spread_min: float = Field(default=1.0, ge=0)


class PointIn(BaseModel):
    name: str
    km: float = Field(ge=0)
    type: Literal["persimpangan", "putar_balik", "water_station", "lurus"]


class SimConfig(BaseModel):
    categories: list[CategoryIn] = Field(min_length=1)
    points: list[PointIn] = []
    seed: int = 42
    capacity: float = Field(default=1500.0, gt=0)
    step_km: float = Field(default=0.1, ge=0.02, le=1.0)
    dt_min: float = Field(default=1.0, ge=0.5, le=10.0)