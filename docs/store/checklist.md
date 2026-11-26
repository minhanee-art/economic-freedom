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
| ☐ | 가이드라인 4.2 최소 기능 | "useful, unique, 'app-like'"이어야 함. **위험**: 현재 앱은 조회 전용이며 입력 기능이 웹에만 있음. 거절 시 대응 계획(예: 모바일 입력 기능 추가)을 미리 정할 것 | 위 가이드라인 페이지(원문 확인) |
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
3. 웹의 텔레그램 봇 `TELEGRAM_CHAT_ID` 설정 여부 확인(미설정이면 누구나 봇 사용 가능, OpenAI 비용·데이터 전송 문제).
4. 모바일 최소 기능(4.2) 보강 여부 결정.
5. EAS iOS 제출 설정, 최종 웹 도메인.
6. 실제 기기에서 가입 → 데이터 조회 → 계정 삭제 흐름 시연 확인(아직 하지 않음).
