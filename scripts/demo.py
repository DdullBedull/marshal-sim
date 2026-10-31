import numpy as np

from marshal_sim.route import load_gpx
from marshal_sim.runners import Category, generate_runners
from marshal_sim.simulate import simulate_density

route = load_gpx("data/sample.gpx")
cats = [Category("4K", distance_km=4.0, count=1000, pace_mean=6.0, pace_std=1.0)]
runners = generate_runners(cats, seed=42)
res = simulate_density(route, runners)

i_t, i_d = np.unravel_index(res.density.argmax(), res.density.shape)
print(f"Pelari: {len(runners.pace)}")
print(f"Durasi simulasi: {res.times_min[-1]:.0f} menit")
print(
    f"Puncak: {res.density.max():.0f} pelari/km "
    f"di km {res.centers_km[i_d]:.2f} pada menit {res.times_min[i_t]:.0f}"
)

print("Jumlah pelari di rute per menit:")
for t in (0, 5, 10, 20, 30):
    if t < len(res.times_min):
        print(f"  menit {t}: {res.density[t].sum() * res.step_km:.0f}")