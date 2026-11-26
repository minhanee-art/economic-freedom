#!/usr/bin/env bash
# DB 통합 테스트 실행 — 일회용 Postgres를 띄우고 실제 SQL로 검증한다.
#   - src/test/portfolio-returns.db.test.ts (getPortfolioReturnSummary)
#   - src/test/account-delete.db.test.ts   (DELETE /api/me 계정 삭제)
#   - src/test/auth-hardening.db.test.ts   (세션 버전 토큰 폐기, Google 첫 연결 선점 차단, 계좌 지정 소유권)
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

for test_file in src/test/portfolio-returns.db.test.ts src/test/account-delete.db.test.ts src/test/auth-hardening.db.test.ts; do
  # 테스트마다 스키마를 비워 서로의 테이블 정의가 섞이지 않게 한다.
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
  echo "▶ ${test_file}"
  TEST_DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@127.0.0.1:${PORT}/${DB_NAME}" \
    node --import tsx --test --experimental-test-module-mocks "$test_file"
done
