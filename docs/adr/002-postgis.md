# ADR 002: PostGIS and approximate location

Status: accepted. PostGIS performs internal distance operations. Client-visible results use approximate areas or distance buckets and never expose stored coordinates.
