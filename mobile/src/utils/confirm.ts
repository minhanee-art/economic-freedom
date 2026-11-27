import { Alert } from "react-native";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
};

/** 되돌릴 수 없는 동작 전에 확인을 받는다. 네이티브는 Alert(취소/확인 버튼). 웹은 confirm.web.ts 가 대신 쓰인다. */
export function confirmDestructive({ title, message, confirmText, onConfirm }: ConfirmOptions): void {
  Alert.alert(title, message, [
    { text: "취소", style: "cancel" },
    { text: confirmText, style: "destructive", onPress: onConfirm },
  ]);
}
