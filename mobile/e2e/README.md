# 모바일 종단 간 스모크 테스트 (Expo web + Playwright)

실기기·에뮬레이터 없이 모바일 앱 화면을 실제로 조작해 보는 스모크 테스트입니다.
Expo web 타깃(react-native-web)을 로컬 Next.js 서버·일회용 Postgres 에 붙여 Chromium(Pixel 7 뷰포트)으로 돌립니다.

## 실행

```bash
npm ci                                  # 저장소 루트
(cd mobile && npm ci --legacy-peer-deps) # mobile/ — expo-router 의 선택 peer(reanimated) 충돌 때문에 필요
./scripts/mobile-e2e/run.sh             # 저장소 루트에서
```

필요한 것: Docker, Node 22, `~/.cache/ms-playwright` 의 Chromium(없으면 스크립트가 받는다).
Playwright 는 저장소 의존성에 넣지 않고 `$TMPDIR/pension-mobile-e2e-playwright` 에 임시 설치합니다(`PLAYWRIGHT_DIR` 로 변경).

결과는 `mobile/e2e/artifacts/`(gitignore)에 남습니다: 단계별 스크린샷, `results.json`(단계 결과·콘솔 오류/경고·실패 요청·
모든 API 요청의 계좌 헤더와 상태 코드), `next.log`, `expo.log`. 스크립트가 끝나면(실패·중단 포함) 서버·Expo·컨테이너를 모두 정리합니다.
`E2E_KEEP_UP=1` 을 주면 테스트 뒤 서버를 띄워 둔 채 기다렸다가 Enter 로 정리합니다(직접 화면을 볼 때).

## 구성

| 파일 | 역할 |
| --- | --- |
| `scripts/mobile-e2e/run.sh` | Postgres(postgres:16, `neon-schema.sql`) → Next 개발 서버 → CORS 프록시 → Expo web → Playwright 순서로 띄우고 정리 |
| `scripts/mobile-e2e/neon-pg-shim.mjs` | 서버는 Neon HTTP 드라이버(`neon()`)라 로컬 Postgres 에 직접 붙지 못한다. `NODE_OPTIONS=--import` 로 주입해 드라이버의 HTTP 요청(`https://api.<host>/sql`)을 `pg` 로 실행한다. 앱 코드는 바꾸지 않는다 |
| `scripts/mobile-e2e/cors-proxy.mjs` | 서버가 CORS 헤더를 보내지 않으므로 브라우저(웹 타깃)에서만 필요한 프록시. 네이티브 앱은 CORS 를 적용하지 않는다 |
| `mobile/e2e/smoke.mjs` | 회원가입 → 로그인 → 다섯 탭 → 계좌 전환(헤더·유지) → 매수 추가/삭제 → 배당 추가/삭제 → 연금 요약 → 비밀번호 변경 → 로그아웃 → 재로그인 → 계정 삭제 |

서버 환경변수는 모두 더미 값이며 `env -i` 로 띄워 `.env.local` 이나 운영 값을 읽지 않습니다(`TZ=UTC` 로 Vercel 과 같은 시간대).
`smoke.mjs` 는 localhost 이외의 주소를 거부합니다. 두 번째 계좌와 보유 종목은 모바일에서 만들 수 없어 API 로 준비합니다.

## 이 테스트로 확인되지 않는 것

- 실기기 렌더링(폰트·안전 영역·키보드·제스처), 네이티브 `expo-secure-store`(웹에서는 `secure-store.web.ts` 의 localStorage 폴백을 씀),
  네이티브 `Alert`(웹에서는 `confirm.web.ts` 의 `window.confirm`), 스토어 빌드(EAS·서명·축소).
- 서버는 `next dev` 와 Neon 드라이버 → pg 심으로 돈다. 실제 Neon HTTP 엔드포인트의 동작 차이는 확인하지 않는다.
