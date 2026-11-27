import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { EmptyHoldings } from "@/components/EmptyHoldings";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, radius, spacing } from "@/styles/theme";
import { formatKRW, formatPercent } from "@/utils/format";

export default function HoldingsScreen() {
  const { summary, accounts, selectedAccountId, selectAccount, isLoading, error, refresh } = usePortfolioSummary();

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.title}>보유자산</Text>
      <Text style={styles.subtitle}>평가금액, 손익, 비중을 한 화면에서 확인합니다.</Text>

      <AccountSwitcher accounts={accounts} selectedAccountId={selectedAccountId} onSelect={selectAccount} />

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/record-purchase")} style={styles.recordButton}>
          <Text style={styles.recordButtonText}>매수 기록 추가</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/add-holding")} style={styles.addButton}>
          <Text style={styles.addButtonText}>종목 추가</Text>
        </Pressable>
      </View>

      {summary ? null : <PortfolioStatus isLoading={isLoading} error={error} onRetry={refresh} />}
      {summary && summary.holdings.length === 0 ? (
        <EmptyHoldings description="이 계좌에 종목을 추가하면 종목별 평가금액·손익·비중이 여기에 표시됩니다." />
      ) : null}

      {(summary?.holdings ?? []).map((holding) => {
        // 원가가 없거나 손익이 0이면 방향 색을 쓰지 않는다
        const pnlColor =
          holding.totalCost <= 0 || holding.profitLoss === 0 ? colors.inkMuted : holding.profitLoss > 0 ? colors.positive : colors.negative;
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
                <Text style={[styles.pnl, { color: pnlColor }]}>
                  {formatKRW(holding.profitLoss)}
                </Text>
                <Text style={[styles.pnlPct, { color: pnlColor }]}>
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
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  recordButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    padding: spacing.md,
  },
  addButton: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  addButtonText: {
    color: colors.ink,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
  },
  recordButtonText: {
    color: colors.surface,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
  },
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
