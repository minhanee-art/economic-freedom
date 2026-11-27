# 데이터 보안(Google Play) / 앱 개인정보(App Store) 답변 초안

> 코드 기준 조사일: 2026-11-27, 브랜치 `docs/store-submission-prep`. 같은 날 main(PR #31~#35 머지 후) 코드로 다시 대조해 갱신함(`chore/post-merge-cleanup`). 이후 PR #36(모바일 매수 기록 삭제)·PR #41(텔레그램 연결 코드)을 `docs/store-telegram-link`에서 반영함. 코드를 읽고 grep으로 확인한 사실만 "확인됨"으로 적었고, 코드에서 확인할 수 없는 것은 **확인 필요**로 표시했습니다.
> 양식 규칙 출처(2026-11-27 확인):
> - Play 데이터 보안 양식: https://support.google.com/googleplay/android-developer/answer/10787469 (본문 앞부분 원문 확인, 뒷부분은 요약 기준)
> - Play 계정 삭제 요건: https://support.google.com/googleplay/android-developer/answer/13327111
> - App Store 앱 개인정보: https://developer.apple.com/app-store/app-privacy-details/
>
> 중요: 이 문서는 **초안**입니다. 제출 전 개인정보처리방침(`src/app/privacy/page.tsx`)과 모순이 없는지 대조해야 하며, 아래 "방침과 코드의 불일치" 절을 먼저 보세요.

## 1. 수집 항목 (코드 근거)

| 데이터 | 어디서 입력/생성 | 저장 위치(코드) | 모바일 앱에서 서버로 전송 | 비고 |
|---|---|---|---|---|
| 이메일 | 가입 화면 (`mobile/src/app/signup.tsx`) | `users.email`, `profiles.email` (`neon-schema.sql`, `src/lib/auth-account.ts`) | 예 | 소문자·공백 정규화 후 저장 |
| 비밀번호 | 가입·로그인 | `users.password_hash`에 **bcrypt 해시(cost 12)**만 저장. 원문 미저장 (`auth-account.ts`) | 가입·로그인·계정 삭제 요청 때 원문이 HTTPS로 전송 | 최소 6자, 최대 72바이트 |
| Google 계정 식별자 | 웹의 'Google로 로그인' (`src/app/api/auth/google/*`) | `users.google_id` | **아니오** (모바일 앱에는 Google 로그인 없음 — `mobile/src/app/login.tsx`는 이메일만) | 웹 로그인을 쓴 경우만. Google에서 이메일·이름도 받음(방침 3항). Google 이름은 `profiles.display_name`에 저장됨(`auth/google/callback/route.ts`, 이름이 없으면 이메일) |
| 세션 토큰(JWT, 30일, 비밀번호 변경·계정 삭제 시 `users.session_version`으로 폐기) | 로그인 응답 | 앱: `expo-secure-store`(`mobile/src/storage/session.ts`), 웹: httpOnly 쿠키 (`src/lib/session.ts`) | 요청마다 `Authorization: Bearer` | 기기 내 암호화 저장소 사용 |
| 보유 종목(종목코드·이름·수량·목표비중·현재가), 평균단가/원가 | **웹에서 입력**(앱의 매수 기록 입력도 수량·원가에 반영됨) | `holdings`, `cost_basis`, `child_holdings` | 앱은 조회(`/api/mobile/portfolio-summary`), 매수 기록 입력 시 전송 | 가입 시 기본 ETF 12종이 자동 생성됨(`DEFAULT_HOLDINGS`, 수량 0) |
| 매수 기록·매도 기록 | 웹, 앱(매수 기록 입력 `mobile/src/app/record-purchase.tsx`) | `purchase_records`, `purchase_items`, `sell_items` | 앱: 매수 기록 입력·최근 기록 조회(`/api/purchases`)·**개별 삭제**(`DELETE /api/purchases/{id}`, 최근 기록의 '삭제' 버튼 + 확인 창, `mobile/src/app/record-purchase.tsx`, `mobile/src/api/records.ts`) | 서버가 날짜·수량 등 입력을 검증(`src/lib/record-validation.ts`). 삭제하면 그 기록이 더했던 보유 수량·원가를 되돌림. 이후 같은 종목 매도 기록이 있거나 보유 수량·원가 기록이 맞지 않으면 서버가 409로 거절하고 아무것도 바꾸지 않음(`src/app/api/purchases/[id]/route.ts`) |
| 배당 기록·배당 캘린더·메모 | 웹, 앱(배당 수령 기록 입력·삭제 `record-dividend.tsx`) | `dividends`, `dividend_calendar` | 앱: 조회·입력·삭제(`/api/dividends`) | 자유 입력 메모 포함(웹) |
| 연금 납입액·연금 수동 입력(국민연금·퇴직연금·연금보험 월 수령액, 본인/배우자) | 웹 | `pension_contributions`, `pension_income_sources` | 앱이 연금 탭에서 **조회**(`/api/pension/*`, 읽기 전용) | |
| 은퇴 목표·은퇴 나이·출생연도·배우자 출생연도·기대수익률·급여 구간·월 적립금 | 웹 | `profiles` 컬럼 | 앱: 목표 월 현금흐름·월 적립금, 연금 설계 요약(`/api/pension/summary`) 조회 | 출생연도·급여 구간은 민감도 높음 |
| 자녀 이름·생년월일, 증여/입금 기록, 신고 여부·메모 | 웹 | `children`, `child_gifts`, `child_holdings` | 앱 미조회 | **제3자(자녀) 개인정보를 이용자가 입력**함 → 확인 필요: 방침 반영 |
| 관심종목 | 웹 | `watchlist` | 앱 미조회 | |
| 텔레그램 chat_id, 연결 확인 시각 | 웹 설정 > 텔레그램 연결에서 연결 코드를 발급(`POST /api/telegram-link`)하고 이용자가 그 코드를 봇에 보내면 웹훅이 **그 메시지의 chat.id**를 저장(`src/lib/telegram-link.ts`). 이용자가 chat_id를 직접 입력하는 경로는 없음(`PATCH`로 저장하는 API 삭제됨, `src/test/api/telegram-link.test.ts`) | `portfolio_accounts.telegram_chat_id`, `telegram_chat_verified_at` (계좌 단위) | **아니오** (`mobile/src`에 텔레그램 관련 코드 없음) | 웹 전용 기능. 화면에는 chat_id 끝 4자리만 표시 |
| 텔레그램 연결 코드 | 연결 코드 발급 시 서버가 생성 | `telegram_link_codes`: **SHA-256 해시**, 사용자·계좌 ID, 발급 당시 세션 버전, 만료 시각(10분), 사용 시각. 평문 코드는 발급 응답에만 한 번 나감 | 아니오 | 1회용. 같은 계좌에 새로 발급하면 이전 미사용 코드 삭제. 만료된 코드는 같은 사용자의 다음 발급 때, 연결 해제·계정 삭제 때 삭제됨(만료 즉시 자동 삭제하는 코드는 읽지 못함) |
| 로그인·가입·비밀번호 변경·계정 삭제 시도 식별자(IP, 이메일/사용자 ID) | 서버가 요청에서 추출 (`src/lib/rate-limit.ts`) | Upstash Redis (설정 시) 또는 서버 메모리 | 요청 헤더로 자동 | 키 예: `mobile-login:{ip}:{email}`, `delete-account:{ip}:{userId}`, `password:{userId}` |

**수집하지 않는 것 (코드 확인)**: 위치, 연락처, 사진/파일, 마이크·카메라, 기기 ID(광고 ID 포함), 결제 정보, 광고·분석·크래시 SDK. 근거: `mobile/package.json` 의존성에 해당 SDK 없음, `mobile/app.json` 권한 선언 없음, `src/`·`mobile/`에서 analytics/Sentry/Firebase 등을 grep했으나 해당 없음(2026-11-27). 앱은 증권사 계좌번호·계좌 비밀번호·주민등록번호를 입력받지 않음(스키마에 해당 컬럼 없음).

## 2. 제3자 전송 (코드의 실제 외부 호출)

`grep -rnoE "https?://"`와 `process.env` 검색으로 확인했습니다.

### 2-1. 이용자 데이터가 나가는 곳

| 서비스 | 코드 위치 | 나가는 데이터 | 이용자 범위 |
|---|---|---|---|
| **Vercel** (호스팅) | `vercel.json`, 전체 API | 모든 요청(이메일, 비밀번호 원문 전송 구간, 입력 데이터, IP) 이 서버를 거침 | 모든 이용자 |
| **Neon** (PostgreSQL) | `src/lib/db.ts` `DATABASE_URL` | 1절의 저장 데이터 전부 | 모든 이용자 |
| **Upstash Redis** (레이트리밋) | `src/lib/rate-limit.ts` (`UPSTASH_REDIS_REST_URL/TOKEN` 설정 시에만) | IP + 이메일 또는 사용자 ID 문자열 (키), 시도 횟수. 10분 슬라이딩 윈도우 | 모든 이용자(설정 시). 미설정이면 서버 메모리 사용 |
| **Google OAuth** | `src/app/api/auth/google/route.ts`, `callback/route.ts` → `accounts.google.com`, `oauth2.googleapis.com/token`, `googleapis.com/oauth2/v2/userinfo` | 인증 코드 교환. Google에서 이메일·식별자 수신 | 웹에서 Google 로그인을 쓴 이용자만 |
| **Telegram Bot API** | `src/lib/telegram.ts`, `src/app/api/portfolio-returns/route.ts`, `src/app/api/telegram-bot/route.ts` | **연결 코드로 소유를 확인한 chat_id**로만 **포트폴리오 수익률 리포트**(계좌 이름·평가금액·원가·손익·기간별 수익률) 전송. 연결 코드 확인 결과(성공·실패 고정 문구)를 그 채팅에 답장 | 웹에서 텔레그램을 연결하고 리포트를 보낸 이용자만. 연결이 없으면 409, 확인되지 않은 chat_id(예전에 직접 입력한 값)로는 보내지 않음. 모바일 앱 이용자는 해당 없음 |

### 2-2. 운영자 개인 계정 데이터만 나가는 곳 (일반 이용자 데이터 아님 — 코드 근거)

`src/app/api/cron/*`과 `src/lib/reports.ts`는 환경변수 `REPORT_USER_ID`/`REPORT_USER_EMAIL`에 지정된 **한 명의 계정**과 `TELEGRAM_CHAT_ID`(운영자 채팅)만 대상으로 동작합니다. 따라서 일반 이용자 데이터가 OpenAI로 가거나 정기 텔레그램 리포트로 나가지 않습니다. 단, 운영 환경에서 이 환경변수가 실제로 어떤 계정으로 설정됐는지는 코드로 알 수 없어 **확인 필요**입니다.

텔레그램 봇(`src/app/api/telegram-bot/route.ts`)은 PR #41 이후 코드 기준으로 두 갈래이며 둘 다 **기본 거부(fail closed)** 입니다.
- 공통: `TELEGRAM_WEBHOOK_SECRET`이 없으면 요청을 처리하지 않고(503), `X-Telegram-Bot-Api-Secret-Token` 헤더가 다르면 401입니다(연결 코드 메시지도 포함, `src/lib/telegram-bot-auth.ts`).
- **연결 코드 경로**: `/start <코드>`·`/link <코드>`·코드만 보낸 메시지는 허용 목록과 무관하게 받습니다. chat_id별 10분 10회 제한 → 코드 확인(DB) → 고정 문구 답장만 하며 OpenAI는 호출하지 않습니다. 틀린 코드·만료·재사용은 같은 문구로 답하고, 한도를 넘으면 답하지 않습니다. 코드는 10자리·10분·1회용이고 DB에는 해시만 저장하며, 발급 이후 비밀번호 변경·Google 첫 연결 등으로 세션이 폐기되면 그 코드는 무효입니다(`src/lib/telegram-link.ts`). 코드 발급 API는 사용자별 10분 10회 제한입니다.
- **질문 답변 경로**: chat_id가 `TELEGRAM_ALLOWED_CHAT_IDS`·`TELEGRAM_CHAT_ID` 목록에 없으면 OpenAI를 호출하지 않고 무시합니다. 목록이 비면 모두 거부합니다. 이 경로는 DB를 조회하지 않습니다. 연결 코드로 확인된 이용자 chat_id는 이 허용 목록에 **들어가지 않으므로** 일반 이용자는 OpenAI 답변 기능을 쓸 수 없습니다.
- 크론 라우트(`src/app/api/cron/*`)는 `Authorization: Bearer <CRON_SECRET>` 헤더만 받고 `?secret=` 쿼리는 받지 않으며, `CRON_SECRET`이 비면 모두 거부합니다(`src/lib/cron-auth.ts`).
이전 초안의 "이용자가 입력한 chat_id로 전송"·"TELEGRAM_CHAT_ID 미설정이면 누구의 문장이든 OpenAI로 전달" 서술은 더 이상 맞지 않습니다. 운영 환경에 시크릿·허용 목록이 실제로 설정됐는지는 **미확인**입니다.

OpenAI 프롬프트는 '정보 정리 도구' 규칙(매매 권유·전문가 사칭·단정 전망 금지, 자료 안 지시 무시)을 쓰고, AI가 만든 메시지에는 고지 문구가 붙습니다(`src/lib/ai-text.ts`).

| 서비스 | 위치 | 나가는 데이터 |
|---|---|---|
| **OpenAI** (`api.openai.com/v1/chat/completions`) | `cron/market-close`, `cron/sentiment`, `cron/dividend-news` | 시장 데이터·뉴스 제목·관심종목 이름으로 구성한 프롬프트 (운영자 계정의 `watchlist` 이름 포함) |
| **OpenAI** | `src/app/api/telegram-bot/route.ts` | 허용된 채팅에서 봇에 보낸 질문 문장(최대 500자로 자름) |
| **Telegram** | `cron/*`, `telegram-bot` | 운영자 채팅으로 포트폴리오·시장 리포트, 봇 답변 |

### 2-3. 이용자 식별 정보 없이 호출하는 공개 시세·뉴스 API

| 서비스 | 위치 | 나가는 것 |
|---|---|---|
| 네이버 금융 (`finance.naver.com`, `m.stock.naver.com`, `polling.finance.naver.com`) | `api/prices`, `api/market/*` | 종목코드/검색어. 이용자 식별 정보 없음(서버가 호출하므로 출처 IP는 Vercel) |
| Yahoo Finance (`query1.finance.yahoo.com`) | `api/market/candles`, `indices`, `lib/yahoo.ts`, `cron/technical` | 종목코드/지수 |
| Google News RSS (`news.google.com/rss/search`) | `api/market/news`, `cron/sentiment`, `cron/dividend-news` | 종목명 검색어 |
| 한국투자증권 Open API (`openapi.koreainvestment.com`) | `src/lib/kis.ts` | 운영자의 `KIS_APP_KEY/SECRET`으로 시세 조회. 이용자 데이터 없음 |
| jsDelivr CDN | `src/app/layout.tsx` (Pretendard 글꼴) | **웹 방문자 브라우저**가 직접 요청 → IP 노출. 모바일 앱은 해당 없음 |

모바일 앱은 위 시세·뉴스 API를 직접 호출하지 않고 **자체 서버(`EXPO_PUBLIC_API_BASE_URL`)만** 호출합니다 (`mobile/src/api/client.ts`). `POST /api/prices`는 클라이언트가 보낸 종목코드 배열(최대 30개)을 네이버 등에 조회합니다(`src/app/api/prices/route.ts`). 코드만 나가고 이메일·ID는 나가지 않으나, 종목코드 묶음이 포트폴리오 정보로 간주되는지는 **확인 필요**.

### 2-4. 광고·추적

- 광고 SDK 없음, 데이터 판매 없음, 앱 간 추적(ATT) 없음 — 코드·의존성 근거. 광고 ID 미사용.

## 3. 암호화

| 항목 | 상태 | 근거 |
|---|---|---|
| 전송 중 암호화 | 예 (HTTPS) | 앱 기본 API 주소 `https://…vercel.app` (`mobile/eas.json`). 앱에 http 예외 설정 없음(`mobile/app.json`). 서버 측 강제 리다이렉트는 Vercel 기본 동작 — **확인 필요** |
| 비밀번호 | bcrypt 해시(cost 12) | `src/lib/auth-account.ts` |
| 기기 내 세션 토큰 | `expo-secure-store` (iOS 키체인 / Android Keystore 기반) | `mobile/src/storage/session.ts` |
| 서버 저장 데이터(저장 시 암호화) | **확인 필요** | 앱 코드에서 필드 암호화 없음. Neon/Vercel의 저장 시 암호화 여부는 업체 문서로 확인 필요 |
| iOS 수출 규정 | `ITSAppUsesNonExemptEncryption: false` 선언 | `mobile/app.json`. 이 값이 맞는지는 Apple 공식 문서로 재확인 필요 → `checklist.md` |

## 4. 삭제 방법

- 앱 내: 설정 탭 → 계정 삭제 → 비밀번호 확인 → 확인 대화상자 → 영구 삭제 (`mobile/src/app/(tabs)/settings.tsx`, `delete-account.tsx`). 서버는 `DELETE /api/me` (`src/app/api/me/route.ts`)에서 속도 제한(IP+사용자)과 비밀번호(Google 전용 계정은 이메일) 확인 후 `DELETE FROM users` 한 줄로 삭제하며, 모든 데이터 테이블이 `ON DELETE CASCADE`(`neon-schema.sql`)로 연결돼 함께 삭제됩니다.
- 개별 데이터: 모바일 앱의 매수 기록 화면에서 최근 매수 기록을 한 건씩 삭제할 수 있고(확인 창 있음), 배당 수령 기록도 앱에서 삭제할 수 있습니다. 매수 기록을 삭제하면 그 기록이 더했던 보유 수량·원가가 되돌아갑니다. 이후 같은 종목 매도 기록이 있는 등 정확히 되돌릴 수 없으면 서버가 거절하고 아무것도 바꾸지 않습니다(`src/app/api/purchases/[id]/route.ts`, `mobile/src/app/record-purchase.tsx`). 이것은 계정 삭제를 대신하지 않습니다.
- 텔레그램 연결 해제: 웹 설정 > 텔레그램 연결에서 계좌별로 해제(`DELETE /api/telegram-link`). 확인된 chat_id·확인 시각·미확인 chat_id·그 계좌의 미사용 연결 코드를 지웁니다(`src/lib/telegram-link.ts` `unlinkTelegram`). 모바일 앱에는 이 화면이 없습니다. 계정 삭제 때는 `telegram_link_codes`도 `ON DELETE CASCADE`로 함께 삭제됩니다(`src/lib/telegram-link.ts`).
- 웹: 설정 화면 맨 아래 '계정 삭제'(방침·삭제 안내 페이지 기준. 웹 설정 화면 구현 자체는 읽지 않음 — **확인 필요**).
- 웹 링크(Play 필수): `/account-deletion` (`src/app/account-deletion/page.tsx`). 보조로 이메일 요청 안내 포함(`NEXT_PUBLIC_SUPPORT_EMAIL`).
- 주의: 앱 내 삭제 화면은 **비밀번호 입력만** 지원합니다. 모바일에는 Google 로그인이 없으므로 현재 앱 이용자는 모두 비밀번호 계정이지만, 웹에서 Google로만 가입한 계정(비밀번호 없음)이 앱에 로그인할 방법은 없습니다.
- 삭제 범위 밖: 이미 텔레그램으로 전송된 메시지, Upstash 키(만료 시 자동 삭제로 추정 — **확인 필요**), 서버·업체 로그(Vercel 요청 로그 보존 기간 **확인 필요**), 백업(Neon 복구 기간 **확인 필요**).

## 5. Google Play '데이터 보안' 양식 답변 초안

| 질문 | 답변 초안 | 근거/메모 |
|---|---|---|
| 앱이 필수 사용자 데이터 유형을 수집하거나 공유하나요? | 예 (수집). 공유는 아래 설명 참고 | |
| 전송 중 암호화? | 예 | 3절 |
| 사용자가 데이터 삭제를 요청할 수 있나요? | 예 | 앱 내 + 웹 링크 |
| 삭제 URL | `{웹 주소}/account-deletion` | |
| **개인 정보 → 이메일 주소** | 수집. 필수. 목적: 앱 기능, 계정 관리. 공유: 아니오 | 호스팅·DB 업체는 서비스 제공자 처리(양식상 "공유" 제외 해당 여부는 Play 안내 재확인 필요 — **확인 필요**) |
| **개인 정보 → 사용자 ID** | 수집. 필수. 앱 기능, 계정 관리, 보안(레이트리밋) | 서버 UUID, Google 식별자 |
| **개인 정보 → 기타 정보(생년월일 등)** | 수집(자녀 생년월일, 본인·배우자 출생연도). 선택 입력. 앱 기능 | 웹 입력. 앱에서 보이지 않더라도 서비스가 수집함 |
| **재무 정보 → 기타 재무 정보** | 수집. 필수에 가까움(앱의 핵심 기능). 앱 기능 | 보유 종목·수량·평균단가·매수·배당·연금 입력값. Play 유형 분류(사용자 결제 정보/구매 내역/신용 점수/기타 재무 정보) 중 "기타 재무 정보"가 맞는지 **확인 필요** |
| **앱 정보 및 성능** | 수집하지 않음 | 크래시·분석 SDK 없음 |
| **위치/연락처/사진/기기 ID** | 수집하지 않음 | 권한 선언 없음 |
| 비밀번호 | 양식에 별도 항목 없음. 인증 자격 증명으로 "개인 정보" 범주에서 처리 여부 **확인 필요** | |
| 제3자와 공유 | 기본 답: 이용자 데이터를 광고·판매 목적으로 공유하지 않음. 호스팅(Vercel)·DB(Neon)·레이트리밋(Upstash)은 서비스 제공자로 처리. 모바일 이용자에게는 OpenAI·Telegram 전송 없음 | 2절. "서비스 제공자" 예외 문구는 Play 안내 원문으로 **확인 필요** |
| 보안 관행: 독립 보안 검토 | 아니오 | 수행 기록 없음 |

## 6. App Store '앱 개인정보(영양 성분표)' 답변 초안

Apple 정의: 데이터를 기기 밖으로 보내 개발자·파트너가 실시간 처리에 필요한 시간보다 오래 접근할 수 있으면 "수집"(출처: app-privacy-details 페이지, 확인일 2026-11-27). 모든 항목이 **사용자와 연결됨(Linked to You)** 입니다(계정에 저장).

| 데이터 유형 | 수집 | 사용자 연결 | 추적 | 목적 |
|---|---|---|---|---|
| 연락처 정보 → 이메일 주소 | 예 | 예 | 아니오 | 앱 기능, 계정 관리 |
| 식별자 → 사용자 ID | 예 | 예 | 아니오 | 앱 기능 |
| 금융 정보 → 기타 금융 정보 | 예 | 예 | 아니오 | 앱 기능 |
| 사용자 콘텐츠 → 기타 사용자 콘텐츠(배당 메모 등) | 예 | 예 | 아니오 | 앱 기능 |
| 위치, 연락처, 사진, 검색 기록, 사용 데이터, 진단 | 아니오 | – | – | – |

- 위 분류명은 Apple 카테고리명(연락처 정보, 건강, **금융 정보**, 위치, 식별자 등)과 일치하는지 양식에서 재확인 **확인 필요**.
- 개인정보 처리방침 URL 필수(출처: https://developer.apple.com/help/app-store-connect/reference/app-information).
- 이용자 IP는 레이트리밋 키로 일시 저장됨 → Apple 기준에서 별도 "식별자"로 신고할지 **확인 필요**.

## 7. 방침과 코드의 대조 (2026-11-27 main 기준으로 갱신)

`src/app/privacy/page.tsx`가 코드 기준으로 개정되어(커밋 377d383) 이전 초안의 불일치 대부분이 해소됐습니다. 현재 방침 본문과 이 문서를 다시 대조한 결과:

**해소됨 (방침에 반영 확인)**
- OpenAI: 운영자 전용 기능, 허용된 텔레그램 채팅의 질문 문장·운영자 계정 관심종목 이름·시세·공개 뉴스 제목이 전달되고 일반 이용자 계정 데이터는 보내지 않는다고 명시(3항).
- 네이버 금융·Yahoo·Google 뉴스 RSS·한국투자증권 API 호출과 종목 코드·종목명·검색어만 전송한다는 점, jsDelivr 글꼴 요청 시 IP 전달(3항).
- 자녀 이름·생년월일, 출생연도·급여 구간, 연금 수령 정보, 계좌별 일별 평가금액 기록(1항). 자녀 정보는 보호자가 직접 입력한다는 안내(1·6항).
- 가입·로그인·비밀번호 변경·계정 삭제 시도 제한용 IP 처리(1·3항), 텔레그램 chat_id(1항).

**남은 확인 사항**
1. 방침 시행일은 "2026년 9월 29일"인데 본문은 2026-11-27에 개정됐습니다. 시행일을 개정일에 맞출지 결정 필요(이 PR에서는 코드를 고치지 않음).
2. 방침 4항은 업체 로그·백업이 각 업체 정책을 따른다고만 적습니다. Vercel 요청 로그 보존 기간, Neon 백업 복구 기간은 코드로 알 수 없음 → **확인 필요**.
3. 모바일 가입 화면은 "가입하면 개인정보처리방침에 동의한 것으로 봅니다" 문구와 링크만 있고 체크박스가 없습니다(`mobile/src/app/signup.tsx`). 동의 방식이 충분한지는 법률 검토 영역 — **확인 필요**.
4. 방침 2항의 "특정 금융상품의 매수·매도 권유… 기능을 제공하지 않습니다"와 AI 프롬프트의 금지 지시는 `src/test/wording.test.ts`에서 부정문으로만 허용됩니다.
5. 방침은 텔레그램 봇의 접근 통제(웹훅 시크릿·허용 chat_id)를 따로 설명하지 않습니다. 정책 내용이므로 이 문서에서 새로 지어내지 않고 검토 항목으로만 남깁니다.
6. 방침 본문은 PR #41(`a0f0151`)에서 이미 연결 코드 방식으로 고쳐졌습니다(1항 '텔레그램 리포트', 3항 Telegram). 시행일 갱신 여부 판단은 `checklist.md` D절에 있습니다.
7. 예전에 직접 입력해 확인되지 않은 chat_id는 DB에 남아 있을 수 있습니다(리포트는 보내지 않음, `needsRelink`). 다시 연결하거나 연결을 해제하거나 계정을 삭제할 때까지 남는다는 점이 방침에 적혀 있지 않습니다 → `checklist.md` D절.
