-- Enable PostGIS (hand-written; must run before any table uses the geometry type).
-- Neon and the local postgis/postgis image both ship PostGIS 3.6.
CREATE EXTENSION IF NOT EXISTS postgis;
