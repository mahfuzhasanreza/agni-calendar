-- AlterTable
ALTER TABLE "cell" ADD COLUMN     "tile_id" INTEGER;

-- CreateTable
CREATE TABLE "tile" (
    "id" INTEGER NOT NULL,
    "geom" geometry(Polygon,4326) NOT NULL,

    CONSTRAINT "tile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tile_month" (
    "tile_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "det_modis_t" REAL NOT NULL,
    "det_modis_a" REAL NOT NULL,
    "det_viirs_snpp" REAL NOT NULL,
    "det_viirs_n20" REAL NOT NULL,
    "harm" REAL NOT NULL,
    "harm_lo" REAL NOT NULL,
    "harm_hi" REAL NOT NULL,
    "flag_rank" SMALLINT NOT NULL,

    CONSTRAINT "tile_month_pkey" PRIMARY KEY ("tile_id","month")
);

-- CreateIndex
CREATE INDEX "tile_geom_idx" ON "tile" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "cell_tile_id_idx" ON "cell"("tile_id");
