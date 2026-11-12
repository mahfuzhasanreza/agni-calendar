"""Pipeline settings. Defaults match CLAUDE.md §3.1 / §5 and docs/PLAN.md."""

from dataclasses import dataclass, field

# Sensors stored in cell_month (schema columns). NOAA-21 is accepted on input but not aggregated.
SENSORS = ("MODIS_T", "MODIS_A", "VIIRS_SNPP", "VIIRS_N20", "VIIRS_N21")
MODIS_SENSORS = ("MODIS_T", "MODIS_A")


@dataclass(frozen=True)
class Config:
    # Region bbox (degrees, WGS84): Bangladesh + NE India + western Myanmar.
    west: float = 86.0
    south: float = 20.0
    east: float = 97.0
    north: float = 28.0
    # Grid resolution in degrees.
    grid_res: float = 0.1
    # Detection tile size in degrees (export files).
    tile_deg: int = 1
    # Analytics confidence filter (detections outside it are kept in tiles, flagged).
    modis_min_confidence: int = 30
    viirs_confidences: frozenset[str] = field(default_factory=lambda: frozenset({"n", "h"}))
    # First month of the record (MODIS Terra starts 2000-11-01).
    first_month: str = "2000-11"
    # First month with S-NPP for (almost) the whole month (record starts 2012-01-20).
    snpp_first_full_month: str = "2012-02"
    # Static-source mask for NRT rows (no `type` field): snap size in degrees (~0.5 km).
    static_snap_deg: float = 0.005

    @property
    def n_rows(self) -> int:
        return round((self.north - self.south) / self.grid_res)

    @property
    def n_cols(self) -> int:
        return round((self.east - self.west) / self.grid_res)


DEFAULT = Config()
