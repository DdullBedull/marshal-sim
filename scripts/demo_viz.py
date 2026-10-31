import os

from marshal_sim.points import SpecialPoint
from marshal_sim.route import load_gpx
from marshal_sim.runners import Category, generate_runners
from marshal_sim.simulate import simulate_density
from marshal_sim.viz import plot_density_timeseries, plot_heatmap

route = load_gpx("data/sample.gpx")
cats = [
    Category("4K", distance_km=4.0, count=1000, pace_mean=6.0, pace_std=1.0,
             start_spread_min=3.0)
]
runners = generate_runners(cats, seed=42)
res = simulate_density(route, runners)

points = [
    SpecialPoint("Persimpangan A", 1.0, "persimpangan"),
    SpecialPoint("Water Station", 2.0, "water_station"),
    SpecialPoint("Putar Balik", 3.0, "putar_balik"),
]

os.makedirs("output", exist_ok=True)
plot_density_timeseries(res, points, "output/density_per_post.png")
plot_heatmap(res, points, "output/heatmap.png")
print("selesai, cek folder output")