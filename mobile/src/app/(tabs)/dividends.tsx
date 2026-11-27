import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows } from "@/components/Card";
import { ScreenTitle } from "@/components/Parts";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, radius, spacing, type } from "@/styles/theme";
import type { DividendMonth, PortfolioSummary } from "@/types";
import { formatKRW, formatKRWFull } from "@/utils/format";

export default function DividendsScreen() {
  const { summary, accounts, selectedAccountId, selectAccount, isLoading, error, refresh } = usePortfolioSummary();

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <ScreenTitle>배당</ScreenTitle>

      <AccountSwitcher accounts={accounts} selectedAccountId={selectedAccountId} onSelect={selectAccount} />

      <Button label="배당 수령 기록 추가" onPress={() => router.push("/record-dividend")} />

      {summary ? <DividendContent summary={summary} /> : <PortfolioStatus isLoading={isLoading} error={error} onRetry={refresh} />}
    </AppShell>
  );
}

function DividendContent({ summary }: { summary: PortfolioSummary }) {
  const monthlyAverage = summary.expectedAnnualDividend / 12;
  const calendar = summary.dividendCalendar ?? [];

  return (
    <>
      <Card title="예상 연 배당">
        <Text style={type.numberLg}>{formatKRW(summary.expectedAnnualDividend)}</Text>
        <Text style={[type.label, styles.tabular]}>12개월로 나누면 월 {formatKRW(monthlyAverage)}</Text>
      </Card>

      <Card title="월별 흐름">
        <MonthlyBars months={summary.dividends} />
      </Card>

      <Card title="예정 일정">
        {calendar.length === 0 ? <Text style={[type.body, styles.muted]}>예정된 배당 일정이 없습니다.</Text> : null}
        <Rows>
          {calendar.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.calendarRow}>
              <View style={styles.calendarMain}>
                <Text style={type.body}>{item.stock}</Text>
                <Text style={[type.caption, styles.tabular]}>{item.date}</Text>
              </View>
              <Text style={type.label}>{item.type}</Text>
            </View>
          ))}
        </Rows>
      </Card>
    </>
  );
}

const CHART_HEIGHT = 140;

/**
 * 월별 배당 막대. 최고 달과 월 평균을 숫자로 바로 적고, 막대를 누르면 그 달 금액을 보인다.
 * 0원인 달은 막대를 그리지 않고 바닥선만 둔다. 평균은 점선으로 표시한다.
 */
function MonthlyBars({ months }: { months: DividendMonth[] }) {
  const max = Math.max(0, ...months.map((m) => m.amount));
  const peak = months.find((m) => m.amount === max && max > 0) ?? null;
  const average = months.length > 0 ? months.reduce((sum, m) => sum + m.amount, 0) / months.length : 0;
  const [selected, setSelected] = useState<string | null>(null);
  const picked = months.find((m) => m.month === selected) ?? null;

  if (max <= 0) {
    return <Text style={[type.body, styles.muted]}>월별 배당 기록이나 예정 금액이 아직 없습니다.</Text>;
  }

  return (
    <View style={styles.chartBlock}>
      <View style={styles.legend}>
        <Text style={[type.label, styles.tabular]} accessibilityLiveRegion="polite">
          {picked ? `${picked.month} ${formatKRWFull(picked.amount)}` : `최고 ${peak?.month ?? ""} ${formatKRWFull(max)}`}
        </Text>
        <Text style={[type.caption, styles.tabular]}>점선은 아래 막대 12개의 평균 {formatKRWFull(average)}</Text>
      </View>
      <View style={styles.chart}>
        <View style={[styles.avgLine, { bottom: (average / max) * CHART_HEIGHT }]} pointerEvents="none" />
        {months.map((item) => {
          const active = item.month === selected;
          const height = item.amount > 0 ? Math.max((item.amount / max) * CHART_HEIGHT, 2) : 0;
          return (
            <Pressable
              key={item.month}
              accessibilityRole="button"
              accessibilityLabel={`${item.month} ${formatKRWFull(item.amount)}`}
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(active ? null : item.month)}
              style={styles.barHit}
            >
              {height > 0 ? <View style={[styles.bar, { height }, active ? styles.barActive : null]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {months.map((item) => (
          <Text key={item.month} style={[type.caption, styles.axisLabel]} importantForAccessibility="no" accessibilityElementsHidden>
            {item.month.replace("월", "")}
          </Text>
        ))}
      </View>
      <Text style={type.caption}>단위: 월. 막대를 누르면 그 달 금액을 봅니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.inkMuted },
  tabular: { fontVariant: ["tabular-nums"] },
  chartBlock: { gap: spacing.sm },
  legend: { gap: 2 },
  chart: {
    height: CHART_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  avgLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0,
    // iOS 는 네 변이 같은 테두리에서만 점선을 그린다 — 높이 0 + 전체 테두리로 1px 점선을 만든다
    borderWidth: 0.5,
    borderStyle: "dashed",
    borderColor: colors.lineStrong,
  },
  barHit: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderTopLeftRadius: radius.sm / 4, borderTopRightRadius: radius.sm / 4, backgroundColor: colors.primary, opacity: 0.85 },
  barActive: { opacity: 1, backgroundColor: colors.primaryPressed },
  axis: { flexDirection: "row", gap: spacing.xs },
  axisLabel: { flex: 1, textAlign: "center", fontVariant: ["tabular-nums"] },
  calendarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.md },
  calendarMain: { flex: 1, gap: 2 },
});
