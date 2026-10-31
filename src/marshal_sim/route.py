from dataclasses import dataclass

import gpxpy
import numpy as np

EARTH_RADIUS_KM = 6371.0088


@dataclass
class Route:
    lat: np.ndarray
    lon: np.ndarray
    dist_km: np.ndarray  # jarak kumulatif dari start, dalam km

    @property
    def length_km(self) -> float:
        return float(self.dist_km[-1])


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = (
        np.sin((lat2 - lat1) / 2) ** 2
        + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))


def load_gpx(path: str) -> Route:
    with open(path, encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    points = [
        (p.latitude, p.longitude)
        for track in gpx.tracks
        for segment in track.segments
        for p in segment.points
    ]
    if len(points) < 2:
        raise ValueError("GPX harus punya minimal 2 titik track")

    lat, lon = np.array(points).T
    steps = haversine_km(lat[:-1], lon[:-1], lat[1:], lon[1:])
    dist_km = np.concatenate(([0.0], np.cumsum(steps)))
    return Route(lat=lat, lon=lon, dist_km=dist_km)