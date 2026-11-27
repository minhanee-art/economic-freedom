import type { ConfirmOptions } from "./confirm";

// 웹 전용 — react-native-web 의 Alert.alert 는 아무 것도 하지 않아(버튼 콜백이 불리지 않음) 삭제 확인이 진행되지 않는다.
// 브라우저 기본 확인 창으로 대신한다. 네이티브 빌드에는 포함되지 않는다.
export function confirmDestructive({ title, message, onConfirm }: ConfirmOptions): void {
  if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
}
