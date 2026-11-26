import * as SecureStore from "expo-secure-store";

// 마지막으로 고른 계좌. 로그인 사용자별로 구분해 저장해, 다른 계정으로 로그인했을 때 이전 선택을 쓰지 않는다.
const SELECTION_KEY = "economic-freedom-selected-account";

type Selection = { userId: string; accountId: string };

export async function loadSelectedAccountId(userId: string): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(SELECTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Selection>;
    return parsed.userId === userId && typeof parsed.accountId === "string" ? parsed.accountId : null;
  } catch {
    return null;
  }
}

export async function saveSelectedAccountId(userId: string, accountId: string): Promise<void> {
  await SecureStore.setItemAsync(SELECTION_KEY, JSON.stringify({ userId, accountId } satisfies Selection));
}

export async function clearSelectedAccountId(): Promise<void> {
  await SecureStore.deleteItemAsync(SELECTION_KEY);
}

// 탭마다 같은 훅을 쓰므로, 한 곳에서 계좌를 바꾸면 나머지 탭도 다시 불러오게 알린다.
const listeners = new Set<() => void>();

export function subscribeAccountSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAccountSelection(): void {
  listeners.forEach((listener) => listener());
}

/** 기록을 저장·삭제한 뒤 호출한다. 이 훅을 쓰는 모든 탭이 요약을 다시 불러온다. */
export function notifyPortfolioChanged(): void {
  notifyAccountSelection();
}
