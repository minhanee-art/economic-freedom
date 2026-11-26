// 로그인 화면 ?error= 코드 → 고정 안내 문구. 쿼리 값은 화면에 그대로 출력하지 않는다.
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  google_failed: "Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
  google_unverified: "Google에서 이메일 인증이 되지 않은 계정이라 연결할 수 없습니다.",
  google_conflict: "이 이메일은 이미 다른 Google 계정에 연결되어 있습니다.",
};

const GENERIC_LOGIN_ERROR = "로그인 중 오류가 발생했습니다. 다시 시도해주세요.";

/** error 쿼리 값(없으면 null)을 안내 문구로 바꾼다. 모르는 코드는 일반 오류 문구. */
export function loginErrorMessage(code: string | string[] | undefined): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  return Object.hasOwn(LOGIN_ERROR_MESSAGES, value) ? LOGIN_ERROR_MESSAGES[value] : GENERIC_LOGIN_ERROR;
}
