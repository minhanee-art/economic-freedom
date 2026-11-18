#!/usr/bin/env bash
# getPortfolioReturnSummary 통합 테스트 실행 — 일회용 Postgres를 띄우고 실제 SQL로 검증한다.
#   ./scripts/verify-snapshot-db.sh
set -euo pipefail

CONTAINER="pension-verify-snapshot"
PORT="${PORT:-55439}"
DB_NAME="pension_test"
DB_USER="postgres"
DB_PASS="$(openssl rand -hex 12)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker run -d --rm --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "127.0.0.1:${PORT}:5432" \
  postgres:16 >/dev/null

echo "Postgres 기동 대기 (127.0.0.1:${PORT})"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  echo "Postgres가 뜨지 않았습니다." >&2
  exit 1
fi

TEST_DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@127.0.0.1:${PORT}/${DB_NAME}" \
  node --import tsx --test --experimental-test-module-mocks src/test/portfolio-returns.db.test.ts
