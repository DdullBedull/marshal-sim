from dataclasses import dataclass

# bobot tipe titik (asumsi awal, nanti dikalibrasi di fase validasi)
TYPE_WEIGHTS = {
    "persimpangan": 3.0,
    "putar_balik": 2.0,
    "water_station": 2.0,
    "lurus": 1.0,
}


@dataclass
class SpecialPoint:
    name: str
    km: float    # posisi di rute, jarak dari start
    type: str    

    def __post_init__(self):
        if self.type not in TYPE_WEIGHTS:
            raise ValueError(
                f"tipe '{self.type}' tidak dikenal, pilih: {list(TYPE_WEIGHTS)}"
            )

    @property
    def weight(self) -> float:
        return TYPE_WEIGHTS[self.type]