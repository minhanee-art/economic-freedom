# 스토어 제출 체크리스트

확인 방식: 공식 페이지를 에이전트로 열어 읽었습니다(확인일 **2026-11-27**). 페이지 중 일부는 앞부분만 원문이고 나머지는 모델 요약이라 항목마다 구분했습니다. 열지 못했거나 근거가 약한 것은 **미확인(기억 기준)**. 페이지에 "최종 수정일"이 없어 확인일만 적습니다. 정책은 자주 바뀌므로 제출 직전에 재확인하세요.

범례: ☐ 해야 할 일 / 앱 사실은 `mobile/app.json`, `mobile/eas.json` 기준.

## A. Google Play

| ☐ | 항목 | 내용 | 출처 / 확인 상태 |
|---|---|---|---|
| ☐ | 개발자 계정 유형 | 개인 / 조직 두 종류. 금융 상품·서비스(은행, 대출, 주식 거래, 투자 펀드, 가상자산 지갑·거래소)는 **조직 등록 필요**. 조직은 D-U-N-S 필요. 이 앱이 금융 서비스에 해당하는지는 페이지에 없음 → 결정 필요 | https://support.google.com/googleplay/android-developer/answer/10788890 (원문 확인) |
| ☐ | 비공개 테스트 요건 | **2023-11-13 이후 생성된 개인 계정**은 비공개(closed) 테스트에서 **12명 이상이 14일 연속 옵트인** 후 프로덕션 신청. 신청서에 테스트 피드백 요약 포함, 검토는 보통 7일 이내. 조직 계정은 이 페이지에서 다루지 않음. 내부 테스트는 요건 없음 | https://support.google.com/googleplay/android-developer/answer/14151465 (원문 확인) |
| ☐ | 앱 번들 | `eas.json`의 production은 `app-bundle`. 현재 `submit.production.android.track`은 `internal` | `mobile/eas.json` |
| ☐ | 타깃 API 레벨 | 페이지 문구: 2026-08-31부터 신규 앱·업데이트는 **Android 16(API 36) 이상** 타깃, 연장 기한 2026-11-01도 이미 지남. 현재 Expo SDK 57 / RN 0.86 빌드가 API 36을 타깃하는지 **확인 필요**(빌드 산출물 검사) | https://support.google.com/googleplay/android-developer/answer/11926878 (원문 확인) |
| ☐ | 패키지 이름 등록 | 정책 마감일 페이지에 "Android developer verification용 패키지 이름 등록" 항목(마감 2026-09-30)이 있음. 이 앱의 패키지 `kr.kimvibe.economicfreedom` 등록 여부 **확인 필요** | https://support.google.com/googleplay/android-developer/answer/9876714 (요약 기준, 내용 재확인 필요) |
| ☐ | 콘텐츠 등급 | App content → 콘텐츠 등급 설문(IARC), 이메일 입력, 앱 변경 시 재작성. 선행: 광고 여부 선언, 앱 액세스 안내, 개인정보처리방침 | https://support.google.com/googleplay/android-developer/answer/9859655 (원문 확인) |
| ☐ | 타깃 연령 | 연령대 선택(5세 이하…18세 이상). 방침은 만 18세 이상 대상(`src/app/privacy/page.tsx` 6항). "18세 이상만 선택 + Restrict Minor Access" 옵션이 있음. 아동 포함 시 Families 정책 적용 | https://support.google.com/googleplay/android-developer/answer/9867159 (원문 확인) |
| ☐ | 금융 기능 신고 | App content → Financial features. **금융 기능이 없는 앱도 양식 작성 필요**("My app doesn't provide any financial features"). 옵션에 "Stock trading and portfolio management", "Financial advice" 있음. 추적 전용 앱이 해당하는지는 페이지에 없음 → `review-notes.md` 3-3 | https://support.google.com/googleplay/android-developer/answer/13849271 (원문 확인). 정책 본문: https://support.google.com/googleplay/android-developer/answer/9876821 |
| ☐ | 데이터 보안 | 비공개·공개·프로덕션 트랙 앱은 양식 필수(내부 테스트 전용은 면제). 전송 중 암호화·삭제 요청 가능 여부 답변. 답안 초안: `data-safety.md` | https://support.google.com/googleplay/android-developer/answer/10787469 (앞부분 원문, 뒷부분 요약) |
| ☐ | 계정 삭제 URL | 앱 내 삭제 경로 **그리고** 웹 링크 둘 다 필요. 웹 링크는 정상 로드, 삭제 방법이 눈에 띔, 스토어에 표시된 앱/개발자 이름 포함. `/account-deletion` 사용(배포 URL 확정 후 입력) | https://support.google.com/googleplay/android-developer/answer/13327111 (원문 확인) |
| ☐ | 앱 액세스(로그인 정보) | 항상 유효·재사용 가능·2단계 인증 우회·영어. 절차: `review-notes.md` | https://support.google.com/googleplay/android-developer/answer/15748846 (원문 확인) |
| ☐ | 개인정보처리방침 URL | 필수. `/privacy`. 코드와 불일치 항목 정리 필요 → `data-safety.md` 7절 | 위 앱 액세스·콘텐츠 등급 페이지 선행 조건 |
| ☐ | 스토어 등록정보 | 앱 이름 30자, 짧은 설명 80자, 자세한 설명 4,000자, 연락처 이메일 필수, 휴대전화 스크린샷 2~8장, 아이콘 512×512, 피처 그래픽 1024×500 | https://support.google.com/googleplay/android-developer/answer/9859152, https://support.google.com/googleplay/android-developer/answer/9866151 (원문 확인) |
| ☐ | 광고 여부 선언 | 광고 없음으로 선언(코드에 광고 SDK 없음) | `data-safety.md` 2-4 |

## B. App Store

| ☐ | 항목 | 내용 | 출처 / 확인 상태 |
|---|---|---|---|
| ☐ | Apple Developer Program | 연 99 USD. 개인은 거주 지역 성년·2단계 인증 Apple 계정, 조직은 법인과 D-U-N-S(정부 기관 제외) 필요 | https://developer.apple.com/programs/enroll/ (원문 확인) |
| ☐ | 번들 ID·앱 이름 | 번들 ID `kr.kimvibe.economicfreedom`(첫 빌드 업로드 후 변경 불가). 앱 이름 2~30자, 부제 30자 이내 | `mobile/app.json`, https://developer.apple.com/help/app-store-connect/reference/app-information (앞부분 원문). 키워드 100바이트 한도는 **미확인(기억 기준)** |
| ☐ | TestFlight | 내부 테스터 최대 100명(App Store Connect 사용자), 외부 최대 10,000명. 외부 테스터 첫 빌드는 베타 앱 심사 필요, 빌드는 최대 90일 테스트 가능. **iOS 빌드는 `eas.json`에 submit.ios 설정이 없고 iOS 빌드를 만든 적이 있는지 확인 필요** | https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview (앞부분 원문, 한도 수치는 요약 기준) |
| ☐ | 심사 가이드라인 2.1 | 로그인이 있으면 데모 계정(백엔드 켜 둔 상태)이나 데모 모드를 제공. 충돌·미완성 빌드 거절 | https://developer.apple.com/app-store/review/guidelines/ (원문 확인) |
| ☐ | 가이드라인 4.2 최소 기능 | "useful, unique, 'app-like'"이어야 함. 현재 앱은 조회 전용이 아니라 계좌 전환, 연금 설계 요약(읽기 전용), 매수·배당 기록 입력, 비밀번호 변경을 지원함(2026-11-27 코드 확인). 다만 은퇴 목표·연금 소득원 입력은 웹에만 있음. 거절 시 대응 계획을 미리 정할 것 | 위 가이드라인 페이지(원문 확인) |
| ☐ | 가이드라인 4.8 로그인 서비스 | 제3자·소셜 로그인을 주 계정으로 쓰면 동등한 대체 로그인 제공. 모바일 앱은 이메일 로그인만 있어 해당 가능성 낮음. 예외 목록 원문은 요약 기준이라 재확인 | 위 가이드라인 페이지(첫 문장 원문, 예외는 **요약 기준**) |
| ☐ | 가이드라인 5.1.1 | (i) 개인정보처리방침을 메타데이터와 앱 안에 링크 — 앱은 설정 탭·가입 화면에서 링크함. (v) 계정 생성을 지원하면 **앱 내 계정 삭제** 필수 — 설정 탭에 있음 | 5.1.1 본문은 요약 기준 → **재확인 필요**. 삭제 요건은 원문 확인: https://developer.apple.com/support/offering-account-deletion-in-your-app/ |
| ☐ | 가이드라인 3.2.1(viii) | "금융 거래·투자·자금 관리 앱은 해당 서비스를 수행하는 금융기관이 제출해야 하고 면허 필요". 이 앱 해당 여부 → `review-notes.md` 3-3 | 원문 확인 |
| ☐ | 앱 개인정보(영양 성분표) | 신규 앱·업데이트 제출 시 필수, 제3자 파트너 데이터 포함. 답안 초안: `data-safety.md` 6절. 개인정보 처리방침 URL 필수 | https://developer.apple.com/app-store/app-privacy-details/ (원문 확인) |
| ☐ | 수출 규정 | `mobile/app.json`에 `ITSAppUsesNonExemptEncryption: false`. 해당 Apple 페이지는 이 키를 언급하지 않고 면제 판단은 개발자 책임이라고 함 → HTTPS만 쓰는 앱이 면제인지 Apple 문서 "Complying with encryption export regulations"로 **확인 필요**. | https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance (위 키 관련은 **미확인(기억 기준)**) |
| ☐ | 스크린샷 | 기기 크기별 최대 10장, JPEG/PNG, 알파 불가. `supportsTablet: true`라 iPad 13인치 필요. 2027-04부터 iOS 27.1 SDK 이상 앱은 스크린샷 필수라고 페이지에 있음(수치는 요약 기준) | https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications (픽셀 수치 **요약 기준**) |
| ☐ | 심사 메모 | `review-notes.md` 내용 입력, 로그인 정보는 App Store Connect 입력란에만 | 2.1 |

## C. 코드·설정에서 제출 전에 정할 것 (이번 작업에서는 수정하지 않음)

1. `NEXT_PUBLIC_SUPPORT_EMAIL`을 Vercel 환경변수에 설정 — 안 하면 방침·삭제 안내 페이지에 이메일이 표시되지 않고 "스토어 등록정보의 개발자 연락처" 문구로 대체됨(`src/app/privacy/page.tsx`).
2. 방침과 코드 불일치 정리(`data-safety.md` 7절).
3. 텔레그램 연결 코드(PR #41) 운영 설정 — 모두 운영자가 직접 할 일이며 이 문서 작업에서는 하지 않았고 **미확인**입니다(운영 환경변수·웹훅 상태는 코드로 알 수 없음).
   - `TELEGRAM_WEBHOOK_SECRET` 설정: 없으면 웹훅이 연결 코드 메시지까지 모두 503으로 거부(`src/app/api/telegram-bot/route.ts`).
   - 시크릿 설정(또는 변경) 뒤 웹훅 **재등록**: `GET /api/telegram-bot?setup=1` + `Authorization: Bearer <CRON_SECRET>`가 `secret_token`을 붙여 `setWebhook`을 호출(`.env.example`도 같은 안내). 재등록 전에는 Telegram이 헤더를 보내지 않아 401이 됨.
   - `TELEGRAM_BOT_TOKEN` 필요, `TELEGRAM_BOT_USERNAME`은 선택(있으면 `t.me` 딥링크 생성, 없으면 코드만 표시).
   - `CRON_SECRET` 필요: 크론은 `Authorization: Bearer` 헤더만 받고 `?secret=` 쿼리는 받지 않음(`src/lib/cron-auth.ts`). 호출하는 쪽(수동 curl·외부 스케줄러)이 쿼리 방식이었다면 헤더로 바꿔야 함. `vercel.json`의 Vercel Cron은 `CRON_SECRET`을 두면 헤더로 보낸다고 코드 주석에 적혀 있으나 실제 호출은 **미확인**.
   - **기존 사용자 재연결 필요**: 예전에 대시보드에 직접 입력해 둔 chat_id는 확인 시각이 없어 리포트가 나가지 않고 409(`telegram_needs_relink`)가 됨. 이용자가 설정 > 텔레그램 연결에서 코드로 다시 연결해야 함. 별도 마이그레이션이 값을 확인 처리하는 코드는 읽지 못함.
   - 컬럼·테이블(`telegram_chat_verified_at`, `telegram_link_codes`)은 코드가 `IF NOT EXISTS`로 만들고 `neon-schema.sql`에도 있음. 운영 DB 반영 여부는 **미확인**.
4. 모바일 최소 기능(4.2): 입력 기능이 늘었으므로 남은 위험(은퇴 목표 입력이 웹에만 있음)을 판단.
5. EAS iOS 제출 설정, 최종 웹 도메인.
6. 실제 기기에서 가입 → 기록 입력·조회 → 비밀번호 변경 → 계정 삭제 흐름 시연 확인(아직 하지 않음).
7. 이 PR에서 `mobile/npm ci` 실패(react-native-reanimated peer 충돌)를 `mobile/.npmrc`로 해결함. EAS 빌드 자체는 실행하지 않음 → **미확인**.

## D. 개인정보처리방침 시행일·본문 판단 (방침 페이지는 수정하지 않음 — 사용자가 결정)

대상: `src/app/privacy/page.tsx`. 현재 시행일 표기는 `시행일: 2026년 9월 29일`(97행). 방침 파일 이력: 최초 `e185ca5`(2026-09-29), 이후 `15f54c3`(11-26), `377d383`(11-27), `a0f0151`(11-27, PR #41에 포함)에서 본문이 바뀌었으나 시행일 문자열은 한 번도 안 바뀜(`git log -- src/app/privacy/page.tsx`).

**판단: 시행일 갱신 필요.**
- 근거: PR #41(`a0f0151`)이 방침 본문의 처리 항목을 실제로 바꿨습니다 — 1항 '텔레그램 리포트'가 "연결 코드를 봇에게 보낸 채팅의 chat_id와 연결 확인 시각(연결 코드는 해시로만 잠시 보관, 10분 뒤 만료)"으로, 3항 Telegram이 "연결 코드로 본인 채팅임을 확인한 chat_id로만 … 연결은 웹 설정에서 언제든 해제"로 바뀌었습니다. 코드와 일치함은 `src/lib/telegram-link.ts`·`src/app/api/portfolio-returns/route.ts`로 확인했습니다. 수집 항목(연결 확인 시각·연결 코드 해시)이 늘었는데 시행일이 2026-09-29라서, 처음 방침 시행 후 11월에 본문이 바뀐 사실이 표시에 드러나지 않습니다.
- 고칠 문장: `시행일: 2026년 9월 29일` → 방침을 실제로 게시(배포)하는 날짜로 변경. **날짜는 결정 대기**(PR #41 머지·배포일이 맞는지, 새 방침 시행일을 따로 둘지는 사용자 결정). 변경 이력을 남길 거면 "최초 시행 2026-09-29" 같은 표기를 함께 쓸지도 결정 대기.
- 본문 판단(PR #36 포함): **본문 수정 필수는 없음.** 모바일 매수 기록 삭제(PR #36)는 새 수집 항목이 아니라 이용자가 입력한 기록을 지우는 기능이라 방침의 처리 항목과 충돌하지 않으며, 5항 "열람·수정·삭제"는 웹 기준 표현이라 모바일 삭제를 굳이 적지 않아도 모순되지 않습니다(선택 사항).
- 아래는 **선택 사항(사용자 판단)** 입니다. 필수가 아니라 정확성 보강입니다.
  1. 1항 텔레그램 줄의 "연결 코드는 해시로만 잠시 보관하며 10분 뒤 만료" — 코드는 10분 뒤 **무효**가 되지만 행은 같은 사용자의 다음 발급·연결 해제·계정 삭제 때 지워집니다(`issueTelegramLinkCode`, `unlinkTelegram`). "보관 후 삭제"까지 정확히 쓰려면 "만료 후 다음 발급·해제·계정 삭제 시 삭제"로 고치는 것을 검토.
  2. 예전에 직접 입력해 확인되지 않은 chat_id가 DB에 남을 수 있음(`needsRelink`, 리포트는 안 나감). 방침 1항은 "연결 확인한 chat_id"만 적고 있음 → "이전에 직접 입력해 아직 확인되지 않은 chat_id가 남아 있을 수 있으며 다시 연결하거나 해제·계정 삭제하면 삭제됩니다" 취지의 문장 추가 여부 검토. 운영 DB에 실제로 남은 값이 있는지는 **미확인**.
  3. 8항 문의 이메일은 `NEXT_PUBLIC_SUPPORT_EMAIL` 설정 여부에 따라 달라집니다. 공개 문의 이메일이 아직 정해지지 않았으므로 방침의 문의 문장·등록정보 연락처 칸은 **결정 대기**.
- 이 판단은 코드 확인만으로 한 것이며 법적 검토가 아닙니다.

## E. 결정 대기 (문장 의존 목록)

| 결정 | 영향 받는 문서·문장 | 상태 |
|---|---|---|
| 모바일 Google 로그인 지원 여부 | `data-safety.md` 1절 Google 식별자 행의 "모바일 앱에는 Google 로그인 없음", 4절 삭제 주의, `review-notes.md` 4절 마지막 줄, 이 문서 B절 4.8 항목. 현재 코드(`mobile/src/app/login.tsx`)는 이메일만 | **결정 대기** — 현재 문장은 코드 사실 그대로 두고 지어내지 않음 |
| 공개 문의 이메일 | 이 문서 C절 1번, 방침 8항, Play·App Store 연락처 칸, 계정 삭제 안내 | **결정 대기** |
| 패키지 ID(`kr.kimvibe.economicfreedom`) 변경 여부 | 이 문서 A절 '패키지 이름 등록'·B절 '번들 ID' 행(첫 업로드 뒤 변경 불가) | **결정 대기** — 현재 `mobile/app.json` 값을 그대로 적음 |
