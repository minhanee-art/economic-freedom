import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows } from "@/components/Card";
import { EmojiLine, InfoTip } from "@/components/InfoTip";
import { ScreenTitle } from "@/components/Parts";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, radius, spacing, type } from "@/styles/theme";
import type { DividendMonth, PortfolioSummary } from "@/types";
import { formatKRW, formatKRWAxis, formatKRWFull, niceAxisStep } from "@/utils/format";

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

      <Card
        title="월별 흐름"
        info={<InfoTip label="월별 흐름 설명" side="top">가로축은 월, 세로축은 금액(원)입니다. 막대를 누르면 그 달 금액을 봅니다.</InfoTip>}
      >
        <MonthlyBars months={summary.dividends} />
      </Card>

      <Card title="예정 일정">
        {calendar.length === 0 ? <EmojiLine emoji="📅">예정된 배당 일정이 없습니다.</EmojiLine> : null}
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
const AXIS_WIDTH = 40;

/**
 * 월별 배당 막대. 왼쪽에 금액 눈금(0·중간·위, "50만" 식 짧은 표기)과 가로 보조선을 두어 막대 높이를 읽을 수 있게 하고,
 * 최고 달과 월 평균은 위에 숫자로 적는다. 막대(달 한 칸 전체가 누르는 영역)를 누르면 그 달 금액이 위 문구에 나온다.
 * 막대마다 금액을 쓰면 12칸에서 겹치므로 쓰지 않는다. 0원인 달은 막대 없이 바닥선만. 평균은 점선.
 */
function MonthlyBars({ months }: { months: DividendMonth[] }) {
  const max = Math.max(0, ...months.map((m) => m.amount));
  const peak = months.find((m) => m.amount === max && max > 0) ?? null;
  const average = months.length > 0 ? months.reduce((sum, m) => sum + m.amount, 0) / months.length : 0;
  const [selected, setSelected] = useState<string | null>(null);
  const picked = months.find((m) => m.month === selected) ?? null;

  if (max <= 0) {
    return <EmojiLine emoji="💸">배당 기록·예정 금액이 아직 없습니다.</EmojiLine>;
  }

  const step = niceAxisStep(max, 3);
  const top = step * Math.ceil(max / step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const y = (value: number) => (value / top) * CHART_HEIGHT;

  return (
    <View style={styles.chartBlock}>
      <View style={styles.legend}>
        <Text style={[type.label, styles.readout]} accessibilityLiveRegion="polite" aria-live="polite">
          {picked ? `${picked.month} ${formatKRWFull(picked.amount)}` : `최고 ${peak?.month ?? ""} ${formatKRWFull(max)}`}
        </Text>
        <Text style={[type.caption, styles.tabular]}>점선은 12개월 평균 {formatKRWFull(average)}</Text>
      </View>
      <View style={styles.plot}>
        <View style={styles.yAxis} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {ticks.map((tick) => (
            <Text key={tick} style={[type.caption, styles.tick, { bottom: y(tick) - 9 }]}>
              {tick === 0 ? "0" : formatKRWAxis(tick)}
            </Text>
          ))}
        </View>
        <View style={styles.chart}>
          {ticks.slice(1).map((tick) => (
            <View key={tick} style={[styles.grid, { bottom: y(tick) }]} pointerEvents="none" />
          ))}
          <View style={[styles.avgLine, { bottom: y(average) }]} pointerEvents="none" />
          {months.map((item) => {
            const active = item.month === selected;
            const height = item.amount > 0 ? Math.max(y(item.amount), 2) : 0;
            return (
              <Pressable
                key={item.month}
                accessibilityRole="button"
                accessibilityLabel={`${item.month} ${formatKRWFull(item.amount)}`}
                accessibilityState={{ selected: active }}
                aria-pressed={active}
                onPress={() => setSelected(active ? null : item.month)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [styles.barHit, active ? styles.barHitActive : pressed ? styles.barHitPressed : null]}
              >
                {height > 0 ? <View style={[styles.bar, { height }, active ? styles.barActive : null]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={[styles.axis, { marginLeft: AXIS_WIDTH }]}>
        {months.map((item) => (
          <Text
            key={item.month}
            style={[type.caption, styles.axisLabel, item.month === selected ? styles.axisLabelActive : null]}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {item.month.replace("월", "")}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] },
  chartBlock: { gap: spacing.sm },
  legend: { gap: 2 },
  readout: { color: colors.ink, fontVariant: ["tabular-nums"] },
  plot: { flexDirection: "row" },
  yAxis: { width: AXIS_WIDTH, height: CHART_HEIGHT },
  tick: { position: "absolute", right: spacing.xs, lineHeight: 18, fontVariant: ["tabular-nums"] },
  chart: {
    flex: 1,
    height: CHART_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  grid: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
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
  // 달 한 칸 전체가 누르는 영역(칸 사이 빈틈 없음). 막대는 칸 안에서 좌우 2px 안쪽에 그린다.
  barHit: { flex: 1, height: "100%", justifyContent: "flex-end", paddingHorizontal: 2 },
  barHitPressed: { backgroundColor: colors.surfaceMuted },
  barHitActive: { backgroundColor: colors.primarySoft },
  bar: { width: "100%", borderTopLeftRadius: radius.sm / 4, borderTopRightRadius: radius.sm / 4, backgroundColor: colors.primary, opacity: 0.85 },
  barActive: { opacity: 1, backgroundColor: colors.primaryPressed },
  axis: { flexDirection: "row" },
  axisLabel: { flex: 1, textAlign: "center", fontVariant: ["tabular-nums"] },
  axisLabelActive: { color: colors.ink, fontWeight: "600" },
  calendarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.md },
  calendarMain: { flex: 1, gap: 2 },
});
