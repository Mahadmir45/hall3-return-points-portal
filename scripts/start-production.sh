#!/bin/sh
set -e

echo "Applying database schema..."
npx prisma db push --skip-generate

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Seeding database..."
  npx tsx prisma/seed.ts || echo "Seed skipped or already applied"
fi

echo "Starting server..."
exec npm run start -- -p 3000 -H 0.0.0.0
