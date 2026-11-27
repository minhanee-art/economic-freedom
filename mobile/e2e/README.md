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
`E2E_SCRIPT` 로 `mobile/e2e/` 아래의 다른 스크립트를 고를 수 있습니다(기본 `smoke.mjs`).
`E2E_KEEP_UP=1` 을 주면 테스트 뒤 서버를 띄워 둔 채 기다렸다가 Enter 로 정리합니다(직접 화면을 볼 때).

## 구성

| 파일 | 역할 |
| --- | --- |
| `scripts/mobile-e2e/run.sh` | Postgres(postgres:16, `neon-schema.sql`) → Next 개발 서버 → CORS 프록시 → Expo web → Playwright 순서로 띄우고 정리 |
| `scripts/mobile-e2e/neon-pg-shim.mjs` | 서버는 Neon HTTP 드라이버(`neon()`)라 로컬 Postgres 에 직접 붙지 못한다. `NODE_OPTIONS=--import` 로 주입해 드라이버의 HTTP 요청(`https://api.<host>/sql`)을 `pg` 로 실행한다. 앱 코드는 바꾸지 않는다 |
| `scripts/mobile-e2e/cors-proxy.mjs` | 서버가 CORS 헤더를 보내지 않으므로 브라우저(웹 타깃)에서만 필요한 프록시. 네이티브 앱은 CORS 를 적용하지 않는다 |
| `mobile/e2e/screenshots.mjs` | 스토어(Play) 휴대전화 스크린샷 8장 촬영 + 캡션 합성. `E2E_SCRIPT=screenshots.mjs E2E_SCREENSHOT_DIR=<폴더> ./scripts/mobile-e2e/run.sh` — 자세한 내용은 `docs/store/screenshots.md` |
| `mobile/e2e/smoke.mjs` | 회원가입 → **탭바 레이아웃** → **신규 계정(0주 종목) 매수·배당 기록** → 로그인 → 다섯 탭 → 계좌 전환(헤더·유지) → 매수 추가/삭제 → 배당 추가/삭제 → 연금 요약 → **명의자별 세액공제** → 비밀번호 변경 → 로그아웃 → 재로그인 → 계정 삭제 (총 25단계) |

서버 환경변수는 모두 더미 값이며 `env -i` 로 띄워 `.env.local` 이나 운영 값을 읽지 않습니다(`TZ=UTC` 로 Vercel 과 같은 시간대).
`smoke.mjs` 는 localhost 이외의 주소를 거부합니다. 두 번째 계좌와 보유 종목은 모바일에서 만들 수 없어 API 로 준비합니다.

## 추가된 점검 (PR #46 에서 19/19 통과하고도 놓친 것)

- **탭바 레이아웃**: 다섯 탭 라벨의 bounding box 가 뷰포트·탭바·탭 영역 안에 들어오고, 라벨 요소 안쪽이 잘리지 않는지(`scrollHeight > clientHeight`) 확인한다.
  탭 아이콘만 추가된 커밋(20a72b0)의 `_layout.tsx` 로 되돌리면 이 단계가 실패하는 것을 확인했다(라벨 높이 15px 에 대해 그려지는 영역 10px).
- **신규 계정 기록**: 가입 직후(기본 종목이 전부 0주, API 시드 이전)에 홈 '보유 종목 0개', 매수·배당 기록의 0주 종목 처음부터 펼침, 0주 종목 매수 저장,
  다시 열었을 때 '보유하지 않은 종목 N개 보기' 접힘과 펼침/접기 토글을 본다.
- **명의자별 세액공제**: 본인 연금저축·배우자 IRP·자녀 연금저축 계좌와 올해 납입을 API 로 넣고, `/api/pension/summary` 응답(명의자별 납입액·공제 대상/한도·예상 공제액,
  제외된 계좌)을 화면 숫자와 대조한다. 세법 수치는 테스트에 두지 않고 서버 응답에서 읽는다. '소득 구간 미입력' 같은 안내 문구에는 기대값을 걸지 않는다(문구가 바뀔 수 있음).

## 안정성 (부하가 높을 때 시간 초과 방지)

고정 sleep 대신 조건을 기다린다: 첫 `page.goto` 는 Metro 가 번들을 처음 만드는 시간 때문에 30초를 넘길 수 있어 `domcontentloaded` + 화면 문구 대기(최대 120초)로 바꿨고,
계좌 칩 `aria-selected` 는 클릭 직후 한 번 읽지 않고 기대값이 될 때까지 다시 읽으며, 입력 폼은 입력란이 보이고 활성화될 때까지 기다린 뒤 채운다.
기록 화면의 종목 목록은 요약 응답이 도착해 '기록할 계좌' 배너가 그려진 뒤에 읽는다(로딩 중에는 '보유 종목이 없습니다'가 잠깐 보인다).

## 이 테스트로 확인되지 않는 것

- 실기기 렌더링(폰트·안전 영역·키보드·제스처), 네이티브 `expo-secure-store`(웹에서는 `secure-store.web.ts` 의 localStorage 폴백을 씀),
  네이티브 `Alert`(웹에서는 `confirm.web.ts` 의 `window.confirm`), 스토어 빌드(EAS·서명·축소).
- 서버는 `next dev` 와 Neon 드라이버 → pg 심으로 돈다. 실제 Neon HTTP 엔드포인트의 동작 차이는 확인하지 않는다.
