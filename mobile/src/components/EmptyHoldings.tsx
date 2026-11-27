import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/styles/theme";

/**
 * 종목이 하나도 없는 계좌의 빈 상태. 새 계정은 종목 없이 시작하므로 앱에서 바로 '종목 추가'로 보낸다.
 * 0원·0% 같은 계산 결과 대신 이 안내를 보인다.
 */
export function EmptyHoldings({ description }: { description: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>아직 종목이 없습니다</Text>
      <Text style={styles.description}>{description}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/add-holding")} style={styles.button}>
        <Text style={styles.buttonText}>종목 추가</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  title: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  description: { color: colors.inkMuted, fontSize: 14, lineHeight: 21 },
  button: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
  },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
});
