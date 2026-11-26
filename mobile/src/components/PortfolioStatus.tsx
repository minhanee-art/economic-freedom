import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { Card } from "@/components/Card";
import { colors, radius, spacing } from "@/styles/theme";

type PortfolioStatusProps = {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

/** 포트폴리오 데이터가 없을 때(불러오는 중 / 오류) 표시한다. */
export function PortfolioStatus({ isLoading, error, onRetry }: PortfolioStatusProps) {
  if (error) {
    return (
      <Card title="데이터를 불러오지 못했습니다">
        <Text style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonText}>다시 시도</Text>
        </Pressable>
      </Card>
    );
  }
  return isLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null;
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.xxl,
  },
  error: {
    color: colors.negative,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    padding: spacing.lg,
  },
  buttonText: {
    color: colors.surface,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
  },
});
