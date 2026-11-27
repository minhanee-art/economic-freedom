import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows } from "@/components/Card";
import { EmptyHoldings } from "@/components/EmptyHoldings";
import { ScreenTitle } from "@/components/Parts";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, spacing, type } from "@/styles/theme";
import type { Holding } from "@/types";
import { formatKRWFull, formatPercent, formatSignedKRW, pnlArrow, pnlColor } from "@/utils/format";

export default function HoldingsScreen() {
  const { summary, accounts, selectedAccountId, selectAccount, isLoading, error, refresh } = usePortfolioSummary();
  const holdings = summary?.holdings ?? [];

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <ScreenTitle>보유자산</ScreenTitle>

      <AccountSwitcher accounts={accounts} selectedAccountId={selectedAccountId} onSelect={selectAccount} />

      {/* 종목이 있을 때만 보인다. 종목이 없는 계좌는 아래 빈 상태가 '종목 추가'를 한 번만 보인다(매수 기록은 종목이 생긴 뒤에) */}
      {holdings.length === 0 ? null : (
        <View style={styles.actions}>
          <Button label="매수 기록 추가" style={styles.action} onPress={() => router.push("/record-purchase")} />
          <Button label="종목 추가" variant="secondary" style={styles.action} onPress={() => router.push("/add-holding")} />
        </View>
      )}

      {summary ? null : <PortfolioStatus isLoading={isLoading} error={error} onRetry={refresh} />}
      {summary && holdings.length === 0 ? (
        <EmptyHoldings description="이 계좌에 종목을 추가하면 종목별 평가금액·손익·비중이 여기에 표시됩니다." />
      ) : null}

      {holdings.length > 0 ? (
        <Card title={`종목 ${holdings.length}개`}>
          <Rows>
            {holdings.map((holding) => (
              <HoldingRow key={holding.id} holding={holding} />
            ))}
          </Rows>
        </Card>
      ) : null}
    </AppShell>
  );
}

function HoldingRow({ holding }: { holding: Holding }) {
  // 원가가 없거나 손익이 0이면 방향 색·화살표를 쓰지 않는다
  const hasCost = holding.totalCost > 0;
  const color = hasCost ? pnlColor(holding.profitLoss) : colors.inkMuted;
  const arrow = hasCost ? pnlArrow(holding.profitLoss) : "";
  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={[type.body, styles.name]} numberOfLines={2}>
          {holding.name}
        </Text>
        <Text style={type.number}>{formatKRWFull(holding.currentValue)}</Text>
      </View>
      <View style={styles.line}>
        <Text style={[type.caption, styles.tabular, styles.meta]}>
          {holding.code} · {holding.category} · 비중 {holding.allocationPct.toFixed(1)}%
        </Text>
        <Text style={[type.label, styles.tabular, { color }]}>
          {hasCost ? `${arrow} ${formatSignedKRW(holding.profitLoss, true)} (${formatPercent(holding.profitLossPct)})`.trim() : "매수 기록 전"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
  row: { gap: spacing.xs, paddingVertical: spacing.md },
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: spacing.md },
  name: { flexShrink: 1, fontWeight: "600" },
  meta: { flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
});
