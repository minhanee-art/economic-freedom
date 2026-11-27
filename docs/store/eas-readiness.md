# EAS 빌드 준비 상태 점검

> 점검일: 2026-11-27, 브랜치 `docs/store-submission-prep`. **읽기와 로컬 점검만 했습니다.** `eas` 명령(빌드·제출·로그인)은 실행하지 않았고 `mobile/` 의 어떤 파일도 고치지 않았습니다.
> 판정: **준비됨**(코드·파일로 확인) / **확인 필요**(사용자 확인이나 실제 빌드가 있어야 알 수 있음) / **문제**(그대로 제출하면 곤란한 것).
> 공식 문서 근거(2026-11-27 열람): https://docs.expo.dev/build-reference/app-versions/ , https://docs.expo.dev/build-reference/project-upload.md , https://docs.expo.dev/build-reference/easignore.md , https://docs.expo.dev/build-reference/npm-hooks/. `node_modules` 의 expo·EAS 관련 파일에는 `autoIncrement`·`appVersionSource` 설명이 없었습니다(grep 결과 없음).

## 1. 항목별 판정

| 항목 | 판정 | 확인한 사실 / 근거 | 남은 일 |
|---|---|---|---|
| `mobile/.npmrc` (`legacy-peer-deps=true`) | **확인 필요** | git 추적 중(`git ls-files mobile/.npmrc`), `mobile/.gitignore`·`.easignore` 어디에도 제외되지 않음. 문서: 프로젝트 압축본은 "커밋 안 된 파일·추적되지 않는 파일을 포함하고 ignore 파일이 제외한 것만 뺀다". 로컬에서 `mobile/` 에서 `npm ci --legacy-peer-deps` 성공, 플래그 없이 `npm ci --dry-run`(`.npmrc` 적용)도 성공. **EAS 빌드 서버의 `npm ci` 가 이 파일을 읽는지는 문서에 없음**(`.npmrc` 언급 자체가 없음). 파일 안 주석은 "EAS의 npm ci도 이 파일을 읽는다"고 쓰지만 근거를 찾지 못함 | `eas build:inspect --platform android --stage archive --output ./eas-archive` 로 압축본에 `mobile/.npmrc` 가 들어갔는지 확인(문서가 안내한 방법). 실패하면 빌드 로그의 "Install dependencies" 단계에서 ERESOLVE 여부 확인. 대안(설정 파일 수정이라 이번엔 안 함): EAS 환경변수 `NPM_CONFIG_LEGACY_PEER_DEPS=true` 지정 — 효과는 **미확인** |
| `mobile/package-lock.json` | 준비됨 | 추적 중. `npm ci` 는 lock 필요 | |
| `eas.json` `cli.version` | 확인 필요 | `">= 16.0.0"`. 사용자의 `eas --version` 이 이 조건을 만족하는지는 읽지 못함 | `eas --version` |
| `appVersionSource: "local"` | 준비됨 | 버전은 `app.json` 에서 읽음. 문서: local 이면 "app version values 를 읽어 그대로 빌드" | |
| `production.autoIncrement: true` + local | **확인 필요** | 문서는 두 문장이 서로 어긋남: "프로젝트에 쓰지 않는다"와 "autoIncrement 를 쓰면 변경을 **매 빌드 커밋해야 유지된다**". **`app.json` 을 어떻게·어디에 고치는지, 얼마씩 올리는지는 문서에 없음**. 문서에 versionCode 가 `app.json` 에 있을 때, 동적 설정일 때, iOS `buildNumber` 가 없을 때의 동작도 없음(그 설명은 remote 에만 있음) | 빌드 직후 `git diff mobile/app.json` 으로 `versionCode` 가 바뀌었는지 보고, 바뀌었으면 **그 변경을 커밋**(다음 빌드·재현용). 바뀌지 않았으면 EAS 가 올린 번호를 빌드 페이지에서 확인해 `app.json` 에 직접 반영 |
| 현재 `versionCode` | **확인 필요** | `app.json` 과 `npx expo config --type public` 모두 `versionCode: 4`. 로컬 `mobile/builds/economic-freedom-v4.aab` 의 파일명은 v4 이나 **안에 든 versionCode 는 읽지 못함**(AndroidManifest 가 바이너리). 이력: `6945dea` "record android build 3", `459dcd7` "versionCode 4" | **Play Console 에 이미 올린 가장 큰 versionCode 를 확인**(내부 테스트·비공개 트랙 포함). 새 빌드는 그보다 **커야** 함. v4 를 이미 올렸다면 production 빌드는 5 이상이어야 하는데 autoIncrement 가 4→5 로 올릴지는 위 항목처럼 미확인 |
| 기존 `mobile/builds/*.aab` v2~v4 | 준비됨(제출 대상 아님) | `mobile/builds/` 는 `mobile/.gitignore` 의 `builds/` 로 git 미추적(`git check-ignore` 확인), 그래서 EAS 업로드에도 안 들어갈 것. 2026-09-29 v2, 10-01 v3, 10-16 v4 작성. 모두 앱 이름 변경(가족연금계획)·패키지 정책 문서 갱신 **이전** 빌드 | 제출용으로 쓰지 말고 새 production 빌드를 만들 것 |
| `production` 프로필 | 준비됨 | `android.buildType: app-bundle`, `ios.buildConfiguration: Release`, `EXPO_PUBLIC_API_BASE_URL` 지정 | |
| `EXPO_PUBLIC_API_BASE_URL` | **확인 필요** | `preview`·`production` 둘 다 `https://economic-freedom.vercel.app`. 빌드 시점에 번들에 박히므로 최종 웹 도메인이 정해지면 **다시 빌드**해야 함. 이 주소가 지금 응답하는지는 확인하지 않음. `development` 프로필엔 값이 없음 | 최종 도메인 확정(`checklist.md` 사용자 할 일). 방침·계정 삭제 URL 도 같은 도메인이어야 함 |
| `submit.production.android` | **확인 필요** | `track: "internal"` 만 있고 `serviceAccountKeyPath` 가 **없음**. 키 파일이 저장소에 없는 것은 의도적일 수 있음(비밀 키) | `eas submit` 으로 올리려면 Play 서비스 계정 키가 필요(EAS 에 등록했는지는 **미확인**). 처음 올리는 앱은 Play Console 에서 직접 올려야 할 수 있음 — 이 점은 이번에 문서로 **확인하지 못함** |
| `submit.production.ios` | **확인 필요** | 설정 없음(ascAppId 등). iOS 빌드를 만든 적이 있는지도 이 저장소에서는 알 수 없음 | iOS 를 낼 때만 필요 |
| iOS `bundleIdentifier` | 준비됨(결정 대기 연동) | `kr.kimvibe.economicfreedom`. 변경 여부는 **결정 대기** | 아래 패키지 ID 항목 |
| iOS `ITSAppUsesNonExemptEncryption` | 확인 필요 | `app.json` `ios.infoPlist` 에 `false`. 수출 규정 판단은 개발자 책임 | `checklist.md` B절 '수출 규정' |
| iOS `buildNumber` | **확인 필요** | `app.json` 에 없음. local 소스에서 `autoIncrement` 가 없는 `buildNumber` 를 어떻게 처리하는지 문서에 없음 | iOS 빌드 전에 `buildNumber` 를 직접 넣을지(설정 파일 수정은 사용자 결정) 판단 |
| `supportsTablet: true` | 확인 필요 | iPad 스크린샷(13인치)이 필요해짐(`checklist.md` B절). 태블릿 화면을 점검했는지는 기록 없음 | 태블릿 미지원으로 낮출지 결정 |
| `version` | 준비됨 | `1.0.0`(`app.json`, `package.json`) | |
| 이름·아이콘·적응형 아이콘 | 준비됨 | 이름 `가족연금계획`. `assets/icon.png` 1024×1024. 적응형 아이콘 3종(foreground/background/monochrome) 있음 | 스토어용 512 아이콘은 `store-assets/app-icon-512*.png` 가 로컬에 있으나 어느 것이 최종인지 **확인 필요**(2종 + 후보 3종) |
| `slug` | **확인 필요 / 사실상 문제 후보** | 여전히 `economic-freedom`(앱 이름 '가족연금계획'과 다름). `package.json` name 도 `economic-freedom-mobile`. 이 값이 스토어에 노출되는지, EAS 프로젝트(`projectId a374e4aa-…`)와 어긋나 문제가 되는지는 **확인하지 못함** | 바꾸면 EAS 프로젝트·딥링크에 영향이 갈 수 있어 **이번엔 수정하지 않음**. 사용자가 이름 정리 여부 결정 |
| `scheme` | 준비됨 | `economicfreedom`(앱 이름과 다르지만 동작에는 무관) | |
| 패키지 ID `kr.kimvibe.economicfreedom` | **결정 대기** | Play 에 앱을 한 번 만들어 올리면 패키지 이름은 **바꿀 수 없음**(`checklist.md` 의 Apple 번들 ID 와 같은 성격). 변경 여부는 사용자가 결정. 이 문서는 바꾸지 않음 | 결정 후 `app.json` 의 `ios.bundleIdentifier`·`android.package` 를 함께 정리 |
| Android 서명 키(keystore) | **확인 필요** | `*.jks` 는 `.gitignore` 처리. EAS 가 관리하는 키인지, 이전에 직접 만든 키인지는 이 저장소에서 알 수 없음 | `eas credentials` 로 확인(로그인 필요 — 사용자 실행). Play App Signing 사용 여부도 Play Console 에서 확인 |
| 타깃 API 레벨 | **확인 필요** | Expo SDK 57 / RN 0.86 기본 `targetSdk` 가 Play 요구(`checklist.md` A절)를 만족하는지 설정 파일에는 없음 | 새 production aab 를 만든 뒤 Play Console 업로드 단계 경고 또는 `bundletool` 로 확인 |
| 권한 | 준비됨 | `app.json` 에 `android.permissions` 선언 없음. 플러그인: `expo-router`, `expo-status-bar`, `expo-secure-store`, `expo-build-properties`(minify·shrink 켬) | 최종 aab 의 병합 매니페스트 권한은 빌드 후 확인 |
| `npx expo-doctor` | **준비됨** | `mobile/` 에서 실행: **21/21 checks passed. No issues detected!** (2026-11-27) | |
| `.easignore` | 준비됨 | 없음 → `.gitignore` 규칙이 적용됨(문서). `builds/`·`*.jks`·`.env*.local` 은 제외됨 | |

요약: **"문제"로 단정한 항목은 없습니다.** 다만 versionCode 와 Play 에 올라간 번호의 관계, `.npmrc` 가 EAS 에서 읽히는지, autoIncrement 가 `app.json` 을 어떻게 바꾸는지는 **실제 빌드로만 확인**됩니다. slug·패키지 ID·최종 도메인은 사용자 결정 사항입니다.

## 2. 사용자가 직접 실행할 명령 (순서대로, 저장소 루트 기준)

이 문서 작업에서는 실행하지 않았습니다. `eas login` 이 필요한 단계는 사용자가 직접 하세요(`! eas login` 으로 이 세션에서 실행 가능).

1. 최종 머지된 `main` 에서 시작: `git checkout main && git pull`
2. 의존성·점검: `cd mobile && npm ci && npx expo-doctor` (`.npmrc` 가 적용되므로 플래그 불필요. 실패하면 `npm ci --legacy-peer-deps`)
3. Play Console 에서 **지금까지 올린 versionCode 최댓값** 확인 → `mobile/app.json` 의 `android.versionCode` 와 비교(새 빌드가 더 커야 함)
4. `eas --version`(16 이상), `eas whoami`(로그인 확인), 안 되어 있으면 `eas login`
5. 압축본 점검(선택, `.npmrc` 포함 확인): `eas build:inspect --platform android --stage archive --output ./eas-archive` 후 `ls -a ./eas-archive/mobile`(경로는 출력 구조에 따름)
6. 서명 키 확인(선택): `eas credentials`(Android → production)
7. 최종 웹 도메인이 `eas.json` 의 `EXPO_PUBLIC_API_BASE_URL` 과 같은지 확인(다르면 설정 수정 후 커밋 — 사용자 결정)
8. 빌드: `cd mobile && eas build --platform android --profile production`
9. 빌드 후 `git diff mobile/app.json` 으로 `versionCode` 변경 확인 → 변경이 있으면 커밋·PR. 변경이 없으면 EAS 빌드 페이지의 번호를 `app.json` 에 직접 반영(**이 동작은 확인하지 못함**)
10. 산출물(aab) 확인: Play Console 업로드 화면의 경고(타깃 API, 권한, 64비트)를 읽는다
11. 제출: Play Console 에서 **내부 테스트**에 직접 업로드하거나(서비스 계정 키가 없다면) `eas submit --platform android --profile production`
12. iOS 는 별도 결정 후: `eas build --platform ios --profile production`, `buildNumber`·`submit.ios` 설정 필요(위 표)

## 3. 사용자 확인 사항 (이 문서에서 판정할 수 없음)

- Play 에 올린 번호: v2·v3·v4 중 무엇을 어느 트랙에 올렸는지, 현재 최대 versionCode.
- 패키지 ID(`kr.kimvibe.economicfreedom`)를 바꿀지 — **결정 대기**.
- 최종 웹 도메인, slug 정리 여부.
- 서비스 계정 키·EAS 로그인 상태.
