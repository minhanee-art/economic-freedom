# 데이터 보안(Google Play) / 앱 개인정보(App Store) 답변 초안

> 코드 기준 조사일: 2026-11-27, 브랜치 `docs/store-submission-prep`. 코드를 읽고 grep으로 확인한 사실만 "확인됨"으로 적었고, 코드에서 확인할 수 없는 것은 **확인 필요**로 표시했습니다.
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
| 세션 토큰(JWT, 30일) | 로그인 응답 | 앱: `expo-secure-store`(`mobile/src/storage/session.ts`), 웹: httpOnly 쿠키 (`src/lib/session.ts`) | 요청마다 `Authorization: Bearer` | 기기 내 암호화 저장소 사용 |
| 보유 종목(종목코드·이름·수량·목표비중·현재가), 평균단가/원가 | **웹에서 입력** | `holdings`, `cost_basis`, `child_holdings` | 앱은 조회만(`/api/mobile/portfolio-summary`) | 가입 시 기본 ETF 12종이 자동 생성됨(`DEFAULT_HOLDINGS`, 수량 0) |
| 매수 기록·매도 기록 | 웹 | `purchase_records`, `purchase_items`, `sell_items` | 앱은 조회 안 함 | |
| 배당 기록·배당 캘린더·메모 | 웹 | `dividends`, `dividend_calendar` | 앱 조회 | 자유 입력 메모 포함 |
| 연금 납입액·연금 수동 입력(국민연금·퇴직연금·연금보험 월 수령액, 본인/배우자) | 웹 | `pension_contributions`, `pension_income_sources` | 앱 미조회 | |
| 은퇴 목표·은퇴 나이·출생연도·배우자 출생연도·기대수익률·급여 구간·월 적립금 | 웹 | `profiles` 컬럼 | 앱: 목표 월 현금흐름·월 적립금 조회 | 출생연도·급여 구간은 민감도 높음 |
| 자녀 이름·생년월일, 증여/입금 기록, 신고 여부·메모 | 웹 | `children`, `child_gifts`, `child_holdings` | 앱 미조회 | **제3자(자녀) 개인정보를 이용자가 입력**함 → 확인 필요: 방침 반영 |
| 관심종목 | 웹 | `watchlist` | 앱 미조회 | |
| 텔레그램 chat_id | 웹 대시보드 입력 (`dashboard-client.tsx`) | `portfolio_accounts.telegram_chat_id` | **아니오** (모바일 앱에 없음) | 웹 전용 기능 |
| 로그인·가입 시도 식별자(IP + 이메일/사용자 ID) | 서버가 요청에서 추출 (`src/lib/rate-limit.ts`) | Upstash Redis (설정 시) 또는 서버 메모리 | 요청 헤더로 자동 | 키 예: `login:{ip}:{email}`, `delete-account:{ip}:{userId}` |

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
| **Telegram Bot API** | `src/lib/telegram.ts`, `src/app/api/portfolio-returns/route.ts` | 이용자가 입력한 chat_id로 **포트폴리오 수익률 리포트** 텍스트 전송 | 웹에서 chat_id를 설정하고 전송한 이용자만. 모바일 앱 이용자는 해당 없음 |

### 2-2. 운영자 개인 계정 데이터만 나가는 곳 (일반 이용자 데이터 아님 — 코드 근거)

`src/app/api/cron/*`과 `src/lib/reports.ts`는 환경변수 `REPORT_USER_ID`/`REPORT_USER_EMAIL`에 지정된 **한 명의 계정**과 `TELEGRAM_CHAT_ID`(운영자 채팅)만 대상으로 동작합니다. 따라서 일반 이용자 데이터가 OpenAI로 가거나 정기 텔레그램 리포트로 나가지 않습니다. 단, 운영 환경에서 이 환경변수가 실제로 어떤 계정으로 설정됐는지는 코드로 알 수 없어 **확인 필요**입니다.

| 서비스 | 위치 | 나가는 데이터 |
|---|---|---|
| **OpenAI** (`api.openai.com/v1/chat/completions`) | `cron/market-close`, `cron/sentiment`, `cron/dividend-news` | 시장 데이터·뉴스 제목·관심종목 이름으로 구성한 프롬프트 (운영자 계정의 `watchlist` 이름 포함) |
| **OpenAI** | `src/app/api/telegram-bot/route.ts` | 텔레그램 봇에 사용자가 보낸 질문 문장. `TELEGRAM_CHAT_ID`가 설정되면 해당 채팅만 응답, **미설정이면 봇과 대화한 누구의 문장이든 OpenAI로 전달됨** → 운영 환경 설정 **확인 필요** |
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

- 앱 내: 설정 탭 → 계정 삭제 → 비밀번호 확인 → 확인 대화상자 → 영구 삭제 (`mobile/src/app/(tabs)/settings.tsx`, `delete-account.tsx`). 서버는 `DELETE /api/me` (`src/app/api/me/route.ts`)에서 비밀번호(Google 전용 계정은 이메일) 확인 후 `DELETE FROM users` 한 줄로 삭제하며, 모든 데이터 테이블이 `ON DELETE CASCADE`(`neon-schema.sql`)로 연결돼 함께 삭제됩니다.
- 웹: 설정 화면 맨 아래 '계정 삭제'(방침·삭제 안내 페이지 기준. 웹 설정 화면 구현 자체는 이번에 읽지 않음 — **확인 필요**).
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

## 7. 방침과 코드의 불일치 (제출 전 수정 필요 — 이번 작업에서는 코드를 고치지 않음)

`src/app/privacy/page.tsx` 와 위 조사 결과를 대조한 항목입니다.

1. 방침 3항은 OpenAI를 "텔레그램 봇에 보낸 질문 문장이 전달됨"으로만 적었습니다. 코드상 크론(`market-close`, `sentiment`, `dividend-news`)도 OpenAI로 관심종목 이름·시장 데이터를 보냅니다(운영자 계정 한정). 방침에 반영할지 검토.
2. 방침에 **네이버·Yahoo·Google News·한국투자증권 API**(시세·뉴스 조회) 호출이 없습니다. 이용자 식별 정보는 나가지 않지만 종목코드 등이 서버를 통해 전송될 수 있어 언급 여부를 검토.
3. 방침 1항에 **자녀 이름·생년월일**, **출생연도·급여 구간**, **연금 수령 정보**를 명시적으로 적지 않았습니다(포괄 표현은 있음). 자녀 정보는 이용자가 제3자(미성년자)의 정보를 입력하는 것이므로 처리 근거 문구 검토.
4. 방침에 **IP 주소 처리**는 Upstash 항목에만 있고, Vercel 요청 로그 보존은 없습니다.
5. 방침 시행일은 "2026년 9월 29일"입니다. 내용을 바꾸면 갱신해야 합니다.
6. 모바일 앱의 가입 화면은 "가입하면 개인정보처리방침에 동의한 것으로 봅니다" 문구와 링크만 있고 체크박스가 없습니다(`signup.tsx`). 동의 방식이 충분한지는 법률 검토 영역 — **확인 필요**.
