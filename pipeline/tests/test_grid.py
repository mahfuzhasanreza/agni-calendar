import numpy as np
import pytest

from agni import grid
from agni.config import DEFAULT


def test_cell_id_formula():
    # 22.65N 92.25E (Chittagong Hill Tracts) → row 26, col 62
    assert grid.cell_ids(np.array([22.65]), np.array([92.25]))[0] == 26 * 10_000 + 62


@pytest.mark.parametrize(
    ("lat", "expected_row"),
    [
        (22.3, 23),  # (22.3-20)/0.1 = 22.999999999999996 in floating point: must be row 23
        (22.29999, 22),
        (20.0, 0),  # southern edge
        (28.0, 79),  # northern edge belongs to the last row
    ],
)
def test_row_boundaries_are_float_safe(lat, expected_row):
    cid = grid.cell_ids(np.array([lat]), np.array([90.0]))[0]
    assert cid // 10_000 == expected_row


def test_east_edge_belongs_to_last_column():
    assert grid.cell_ids(np.array([24.0]), np.array([97.0]))[0] % 10_000 == DEFAULT.n_cols - 1


def test_points_outside_region_are_rejected():
    with pytest.raises(ValueError, match="outside"):
        grid.cell_ids(np.array([30.0]), np.array([90.0]))


def test_cells_frame_covers_the_grid():
    cells = grid.cells_frame()
    assert len(cells) == DEFAULT.n_rows * DEFAULT.n_cols == 80 * 110
    assert cells["id"].is_unique
    first = cells.iloc[0]
    assert (first["center_lat"], first["center_lon"]) == (20.05, 86.05)
