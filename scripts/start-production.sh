#!/bin/sh
set -e

PORT="${PORT:-3000}"

echo "Applying database schema..."
npx prisma db push --skip-generate

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed || echo "Seed skipped or already applied"
fi

mkdir -p uploads

echo "Starting server on port ${PORT}..."
exec npx next start -H 0.0.0.0 -p "${PORT}"
