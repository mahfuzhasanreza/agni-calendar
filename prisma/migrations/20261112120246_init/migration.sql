-- CreateEnum
CREATE TYPE "Sensor" AS ENUM ('MODIS_T', 'MODIS_A', 'VIIRS_SNPP', 'VIIRS_N20', 'VIIRS_N21');

-- CreateEnum
CREATE TYPE "SourceFlag" AS ENUM ('observed', 'observed_nrt', 'calibrated', 'terra_only_calibrated', 'n20_calibrated', 'gap_filled');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "zone" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cell" (
    "id" INTEGER NOT NULL,
    "row" SMALLINT NOT NULL,
    "col" SMALLINT NOT NULL,
    "res" REAL NOT NULL,
    "center_lat" REAL NOT NULL,
    "center_lon" REAL NOT NULL,
    "geom" geometry(Polygon,4326) NOT NULL,
    "zone_id" INTEGER,
    "ever_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cell_month" (
    "cell_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "det_modis_t" SMALLINT NOT NULL DEFAULT 0,
    "det_modis_a" SMALLINT NOT NULL DEFAULT 0,
    "det_viirs_snpp" SMALLINT NOT NULL DEFAULT 0,
    "det_viirs_n20" SMALLINT NOT NULL DEFAULT 0,
    "modis_ref" REAL,
    "harm" REAL NOT NULL,
    "harm_lo" REAL NOT NULL,
    "harm_hi" REAL NOT NULL,
    "source_flag" "SourceFlag" NOT NULL,

    CONSTRAINT "cell_month_pkey" PRIMARY KEY ("cell_id","month")
);

-- CreateTable
CREATE TABLE "model_run" (
    "model_version" VARCHAR(32) NOT NULL,
    "metric" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "grid_res" REAL NOT NULL,
    "calib_from" INTEGER NOT NULL,
    "calib_to" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "cv_predictions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_run_pkey" PRIMARY KEY ("model_version")
);

-- CreateTable
CREATE TABLE "calibration_model" (
    "id" SERIAL NOT NULL,
    "model_version" VARCHAR(32) NOT NULL,
    "metric" TEXT NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "calibration_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "region" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_bn" TEXT,
    "description" TEXT NOT NULL,
    "story" TEXT,
    "geom" geometry(MultiPolygon,4326) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_run" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "sensor" "Sensor",
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "rows_in" INTEGER,
    "rows_loaded" INTEGER,
    "data_from" DATE,
    "data_to" DATE,
    "status" "IngestStatus" NOT NULL,
    "message" TEXT,

    CONSTRAINT "ingest_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cell_geom_idx" ON "cell" USING GIST ("geom");

-- CreateIndex
CREATE UNIQUE INDEX "calibration_model_model_version_metric_zone_id_season_metho_key" ON "calibration_model"("model_version", "metric", "zone_id", "season", "method");

-- CreateIndex
CREATE UNIQUE INDEX "region_slug_key" ON "region"("slug");

-- AddForeignKey
ALTER TABLE "cell" ADD CONSTRAINT "cell_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_model" ADD CONSTRAINT "calibration_model_model_version_fkey" FOREIGN KEY ("model_version") REFERENCES "model_run"("model_version") ON DELETE CASCADE ON UPDATE CASCADE;
