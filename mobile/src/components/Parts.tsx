import { Linking, StyleSheet, Text, View } from "react-native";
import { webUrl } from "@/api/client";
import { Button } from "@/components/Button";
import { colors, radius, spacing, type } from "@/styles/theme";

/** 화면 제목. 스택 화면은 헤더가 제목을 보이므로 탭 화면에서만 쓴다. */
export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text style={type.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** 계산 가정·안내 문구. 보조 잉크(흰 면 5.1:1). tone=caution 은 추정·한도 초과 같은 주의. */
export function Notice({ children, tone = "plain" }: { children: string; tone?: "plain" | "caution" }) {
  return <Text style={[type.caption, tone === "caution" ? styles.caution : null]}>{children}</Text>;
}

/** 저장 성공 같은 상태 문구. 스크린리더가 바뀐 내용을 읽는다. */
export function StatusMessage({ children }: { children: string }) {
  return (
    <Text style={styles.success} accessibilityLiveRegion="polite" accessibilityRole="text" aria-live="polite">
      {children}
    </Text>
  );
}

/** 폼 전체 오류(서버 응답 등). 필드 하나에 속하는 오류는 TextField 의 error 로 칸 아래에 보인다. */
export function FormError({ children }: { children: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        {children}
      </Text>
    </View>
  );
}

/** 0~100% 진행 막대. 100 을 넘는 값은 막대만 가득 채우고 숫자는 그대로 둔다. */
export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const now = Math.round(Math.min(Math.max(pct, 0), 100));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now }}
    >
      <View style={[styles.fill, { width: `${now}%` }]} />
    </View>
  );
}

/**
 * 앱에서 아직 입력할 수 없는 항목을 웹의 해당 화면에서 열게 한다(개인정보처리방침 링크와 같은 방식: API 기본 주소 + 경로).
 * 주소가 설정되지 않은 빌드에서는 그리지 않는다.
 */
export function WebLinkButton({ path, label = "웹에서 입력" }: { path: string; label?: string }) {
  const url = webUrl(path);
  if (!url) return null;
  return (
    <Button
      label={label}
      variant="secondary"
      compact
      accessibilityRole="link"
      accessibilityHint="브라우저에서 웹 화면을 엽니다"
      onPress={() => void Linking.openURL(url)}
    />
  );
}

export const RETIREMENT_WEB_PATH = "/dashboard/retirement";

const styles = StyleSheet.create({
  caution: { color: colors.caution },
  success: { ...type.label, color: colors.success },
  errorBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  errorText: { ...type.label, color: colors.danger },
  track: {
    height: 8,
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.track,
  },
  fill: { height: "100%", backgroundColor: colors.primary },
});
