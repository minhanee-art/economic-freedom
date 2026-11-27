import { ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing, type } from "@/styles/theme";

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
        <Text style={[type.body, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
        <Button label="다시 시도" variant="secondary" compact onPress={onRetry} />
      </Card>
    );
  }
  return isLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} accessibilityLabel="불러오는 중" /> : null;
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
});
