import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "@/components/AppText";
import { colors, radius, spacing, touchTarget } from "@/styles/theme";

export type ButtonVariant = "primary" | "secondary" | "danger" | "link" | "dangerLink";

type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: ButtonVariant;
  /** 요청 중: 누를 수 없고 스크린리더에 busy 로 알린다. 입력이 모자란 경우에는 쓰지 말고 눌렀을 때 이유를 보인다. */
  busy?: boolean;
  /** 글자 대신 보일 진행 문구(예: "저장 중") */
  busyLabel?: string;
  /** 줄 안에서 내용 폭만큼만 차지한다(기본은 가로 전체). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * 공통 버튼. 눌림 피드백: 안드로이드는 물결(ripple), iOS·웹은 눌린 동안 배경을 바꾼다.
 * 높이는 터치 대상 최소 44 이상. 텍스트 버튼(link·dangerLink)도 같은 최소 크기를 갖는다.
 * 빨강(danger·dangerLink)은 계정 삭제와 확인 단계에만 쓴다. 목록의 기록 삭제는 secondary(잉크 글자 + 테두리).
 */
export function Button({ label, variant = "primary", busy = false, busyLabel, compact, disabled, style, ...rest }: ButtonProps) {
  const inactive = busy || !!disabled;
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      accessibilityState={{ ...rest.accessibilityState, disabled: inactive, busy }}
      disabled={inactive}
      android_ripple={{ color: variant === "primary" || variant === "danger" ? colors.rippleOnPrimary : colors.ripple }}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : null,
        v.box,
        pressed && !inactive ? v.pressed : null,
        inactive && (variant === "primary" || variant === "danger") ? styles.inactiveFilled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          v.text,
          inactive && (variant === "primary" || variant === "danger") ? styles.inactiveText : null,
          inactive && variant === "secondary" ? styles.inactiveOutlineText : null,
        ]}
        numberOfLines={2}
      >
        {busy && busyLabel ? busyLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  compact: { alignSelf: "flex-start" },
  text: { fontSize: 15, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  inactiveFilled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  inactiveText: { color: colors.disabledInk },
  inactiveOutlineText: { color: colors.inkMuted },
});

const VARIANTS: Record<ButtonVariant, { box: ViewStyle; pressed: ViewStyle; text: { color: string } }> = {
  primary: {
    box: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed },
    text: { color: colors.onPrimary },
  },
  secondary: {
    box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
    pressed: { backgroundColor: colors.surfaceMuted },
    text: { color: colors.ink },
  },
  danger: {
    box: { backgroundColor: colors.danger },
    pressed: { opacity: 0.85 },
    text: { color: colors.onPrimary },
  },
  link: {
    box: { backgroundColor: "transparent", paddingHorizontal: spacing.sm },
    pressed: { backgroundColor: colors.surfaceMuted },
    text: { color: colors.primary },
  },
  dangerLink: {
    box: { backgroundColor: "transparent", paddingHorizontal: spacing.sm },
    pressed: { backgroundColor: colors.dangerSoft },
    text: { color: colors.danger },
  },
};
