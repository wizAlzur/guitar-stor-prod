#!/bin/sh
set -eu

for file in /migrations/*.up.sql; do
  echo "Applying migration: $file"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$file"
done
