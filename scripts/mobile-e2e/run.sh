#!/usr/bin/env bash
# 모바일 앱(Expo web 타깃) 종단 간 스모크 테스트를 로컬에서 처음부터 끝까지 실행한다.
#
#   ./scripts/mobile-e2e/run.sh
#
# 하는 일 (모두 로컬, 운영 DB·운영 서버에는 요청하지 않는다):
#   1. 일회용 Docker Postgres(postgres:16)를 띄우고 neon-schema.sql 을 적용한다.
#   2. Next.js 개발 서버를 더미 환경변수로 띄운다(.env.local 을 읽지 않도록 env -i 로 격리).
#      서버는 Neon HTTP 드라이버라 로컬 Postgres 에 직접 붙지 못한다 → neon-pg-shim.mjs 를
#      NODE_OPTIONS=--import 로 주입해 드라이버의 fetch 를 pg 로 실행한다(앱 코드는 그대로).
#   3. CORS 프록시(cors-proxy.mjs)를 띄운다 — 서버가 CORS 헤더를 주지 않아 브라우저(웹 타깃)에서만 필요하다.
#   4. EXPO_PUBLIC_API_BASE_URL 을 프록시로 맞춘 Expo web 을 띄운다.
#   5. mobile/e2e/smoke.mjs(Playwright, Chromium, Pixel 7 뷰포트)로 흐름을 조작한다.
#   6. 종료 시(성공·실패·중단 모두) 서버·프록시·Expo·컨테이너를 정리한다.
#
# 사전 조건: Docker, 루트와 mobile/ 의 node_modules(npm ci; mobile 은 npm ci --legacy-peer-deps).
# Playwright 는 저장소 의존성에 넣지 않는다. PLAYWRIGHT_DIR(기본: $TMPDIR/pension-mobile-e2e-playwright)에
# playwright@$PLAYWRIGHT_VERSION 을 임시 설치해 쓰고, 브라우저는 ~/.cache/ms-playwright 를 쓴다.
#
# 환경변수(선택): E2E_DB_PORT(55461) E2E_NEXT_PORT(3461) E2E_PROXY_PORT(3462) E2E_EXPO_PORT(8461)
#                 E2E_OUT(mobile/e2e/artifacts — 스크린샷·results.json·서버 로그, .gitignore 처리)
#                 PLAYWRIGHT_DIR, PLAYWRIGHT_VERSION(1.60.0), E2E_KEEP_UP=1(테스트 뒤 서버를 남겨 두고 Enter 로 정리)
#                 E2E_SCRIPT(mobile/e2e/ 아래에서 실행할 스크립트, 기본 smoke.mjs. 스토어 스크린샷: screenshots.mjs — 출력 위치는 E2E_SCREENSHOT_DIR)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_PORT="${E2E_DB_PORT:-55461}"
NEXT_PORT="${E2E_NEXT_PORT:-3461}"
PROXY_PORT="${E2E_PROXY_PORT:-3462}"
EXPO_PORT="${E2E_EXPO_PORT:-8461}"
OUT="${E2E_OUT:-$ROOT/mobile/e2e/artifacts}"
E2E_SCRIPT="${E2E_SCRIPT:-smoke.mjs}"
case "$E2E_SCRIPT" in
  */*|*..*|"") echo "E2E_SCRIPT 는 mobile/e2e/ 바로 아래의 파일 이름이어야 합니다: $E2E_SCRIPT" >&2; exit 1 ;;
esac
if [ ! -f "$ROOT/mobile/e2e/$E2E_SCRIPT" ]; then echo "mobile/e2e/$E2E_SCRIPT 가 없습니다." >&2; exit 1; fi
PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-1.60.0}"
PLAYWRIGHT_DIR="${PLAYWRIGHT_DIR:-${TMPDIR:-/tmp}/pension-mobile-e2e-playwright}"
CONTAINER="pension-mobile-e2e-$$"
DB_NAME="pension_e2e"
DB_PASS="$(openssl rand -hex 12)"

mkdir -p "$OUT"
PIDS=()

cleanup() {
  local code=$?
  for pid in "${PIDS[@]}"; do
    # setsid 로 띄웠으므로 프로세스 그룹 전체(next-server, metro 워커 등)를 종료한다.
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${PIDS[@]}"; do kill -KILL -- "-$pid" 2>/dev/null || true; done
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  echo "정리 완료(서버·프록시·Expo·컨테이너 $CONTAINER)."
  exit "$code"
}
trap cleanup EXIT INT TERM

for port in "$DB_PORT" "$NEXT_PORT" "$PROXY_PORT" "$EXPO_PORT"; do
  if ss -ltn "( sport = :$port )" | grep -q LISTEN; then
    echo "포트 $port 가 이미 사용 중입니다. E2E_*_PORT 로 다른 포트를 지정하세요." >&2
    exit 1
  fi
done

wait_http() { # url, label, seconds
  for _ in $(seq 1 "$3"); do
    curl -s -o /dev/null "$1" && return 0
    sleep 1
  done
  echo "$2 이(가) 응답하지 않습니다: $1" >&2
  return 1
}

echo "▶ 1/5 Postgres ($CONTAINER, 127.0.0.1:$DB_PORT)"
docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB_NAME" \
  -p "127.0.0.1:${DB_PORT}:5432" postgres:16 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 1
done
sleep 2 # 초기화 중 재시작 대기
docker exec -i "$CONTAINER" psql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$ROOT/neon-schema.sql" 2>&1 | grep -v NOTICE || true

echo "▶ 2/5 Next.js 개발 서버 (127.0.0.1:$NEXT_PORT, 더미 환경변수)"
(
  cd "$ROOT"
  # TZ=UTC: Vercel 함수와 같은 시간대. (KST 로 돌리면 /api/purchases 의 DATE 가 하루 앞당겨져 보인다 — PR 본문 참고)
  env -i PATH="$PATH" HOME="$HOME" TZ=UTC NEXT_TELEMETRY_DISABLED=1 \
    NEON_SHIM_PG_URL="postgres://postgres:${DB_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}" \
    DATABASE_URL="postgres://shim:shim@db.neon-shim.localhost/${DB_NAME}" \
    JWT_SECRET="e2e-dummy-jwt-secret-$(openssl rand -hex 16)" \
    CRON_SECRET="e2e-dummy-cron-secret" \
    NODE_OPTIONS="--import $ROOT/scripts/mobile-e2e/neon-pg-shim.mjs" \
    setsid npx next dev -p "$NEXT_PORT" -H 127.0.0.1 > "$OUT/next.log" 2>&1 &
  echo $! > "$OUT/.next.pid"
)
PIDS+=("$(cat "$OUT/.next.pid")")
wait_http "http://127.0.0.1:$NEXT_PORT/api/accounts" "Next 서버" 120

echo "▶ 3/5 CORS 프록시 (127.0.0.1:$PROXY_PORT → $NEXT_PORT, 웹 타깃 전용)"
setsid node "$ROOT/scripts/mobile-e2e/cors-proxy.mjs" "$PROXY_PORT" "http://127.0.0.1:$NEXT_PORT" "http://localhost:$EXPO_PORT" \
  > "$OUT/proxy.log" 2>&1 &
PIDS+=("$!")

echo "▶ 4/5 Expo web (localhost:$EXPO_PORT)"
(
  cd "$ROOT/mobile"
  CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:$PROXY_PORT" \
    setsid npx expo start --web --port "$EXPO_PORT" --clear > "$OUT/expo.log" 2>&1 &
  echo $! > "$OUT/.expo.pid"
)
PIDS+=("$(cat "$OUT/.expo.pid")")
wait_http "http://localhost:$EXPO_PORT/" "Expo web" 180
# 첫 번들은 요청 시점에 만든다 — 미리 한 번 받아 둔다.
curl -s -o /dev/null --max-time 300 "http://localhost:$EXPO_PORT/" || true

echo "▶ 5/5 Playwright: $E2E_SCRIPT"
if [ ! -d "$PLAYWRIGHT_DIR/node_modules/playwright" ]; then
  mkdir -p "$PLAYWRIGHT_DIR"
  npm install --prefix "$PLAYWRIGHT_DIR" --no-save --no-audit --no-fund "playwright@$PLAYWRIGHT_VERSION" >/dev/null
fi
"$PLAYWRIGHT_DIR/node_modules/.bin/playwright" install chromium >/dev/null

set +e
E2E_APP_URL="http://localhost:$EXPO_PORT" \
E2E_API_URL="http://127.0.0.1:$PROXY_PORT" \
E2E_DIRECT_API_URL="http://127.0.0.1:$NEXT_PORT" \
E2E_OUT="$OUT" PLAYWRIGHT_DIR="$PLAYWRIGHT_DIR" \
  node "$ROOT/mobile/e2e/$E2E_SCRIPT"
status=$?
set -e

if [ "${E2E_KEEP_UP:-}" = "1" ]; then
  echo "서버를 띄워 둡니다. Expo: http://localhost:$EXPO_PORT  — Enter 를 누르면 정리합니다."
  read -r _
fi
exit "$status"
