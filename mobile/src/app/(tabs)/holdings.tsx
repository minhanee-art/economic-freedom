import { StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, radius, spacing } from "@/styles/theme";
import { formatKRW, formatPercent } from "@/utils/format";

export default function HoldingsScreen() {
  const { summary, isLoading, refresh } = usePortfolioSummary();

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.title}>보유자산</Text>
      <Text style={styles.subtitle}>평가금액, 손익, 비중을 한 화면에서 확인합니다.</Text>

      {summary.holdings.map((holding) => {
        const isPositive = holding.profitLoss >= 0;
        return (
          <Card key={holding.id}>
            <View style={styles.rowBetween}>
              <View style={styles.nameColumn}>
                <Text style={styles.code}>{holding.code}</Text>
                <Text style={styles.name}>{holding.name}</Text>
                <Text style={styles.category}>{holding.category}</Text>
              </View>
              <Text style={styles.allocation}>{holding.allocationPct.toFixed(1)}%</Text>
            </View>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.label}>평가금액</Text>
                <Text style={styles.value}>{formatKRW(holding.currentValue)}</Text>
              </View>
              <View style={styles.pnlColumn}>
                <Text style={styles.label}>손익</Text>
                <Text style={[styles.pnl, { color: isPositive ? colors.positive : colors.negative }]}>
                  {formatKRW(holding.profitLoss)}
                </Text>
                <Text style={[styles.pnlPct, { color: isPositive ? colors.positive : colors.negative }]}>
                  {formatPercent(holding.profitLossPct)}
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    marginBottom: spacing.lg,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  nameColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  code: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  category: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: "800",
  },
  allocation: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  label: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  value: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  pnlColumn: {
    alignItems: "flex-end",
  },
  pnl: {
    marginTop: spacing.xs,
    fontSize: 14,
    fontWeight: "900",
  },
  pnlPct: {
    fontSize: 12,
    fontWeight: "800",
  },
});
