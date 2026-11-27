// 웹 전용 폴백 — Expo web(개발·스모크 테스트)에서만 번들된다. 네이티브 빌드에는 포함되지 않는다.
// expo-secure-store 는 웹 구현이 없어(빈 모듈) 호출하면 "getValueWithKeyAsync is not a function" 으로 실패한다.
// localStorage 는 암호화 저장소가 아니므로, 웹 타깃을 실제 서비스로 배포한다면 별도 검토가 필요하다.
export async function getItemAsync(key: string): Promise<string | null> {
  return globalThis.localStorage?.getItem(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  globalThis.localStorage?.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  globalThis.localStorage?.removeItem(key);
}
