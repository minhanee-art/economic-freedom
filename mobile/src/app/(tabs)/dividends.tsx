import { StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, radius, spacing } from "@/styles/theme";
import { formatKRW } from "@/utils/format";

export default function DividendsScreen() {
  const { summary, isLoading, refresh } = usePortfolioSummary();
  const maxDividend = Math.max(...summary.dividends.map((item) => item.amount), 1);
  const monthlyAverage = summary.expectedAnnualDividend / 12;

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.title}>배당</Text>
      <Text style={styles.subtitle}>받은 배당과 앞으로 받을 현금흐름을 월 단위로 봅니다.</Text>

      <Card title="예상 연 배당">
        <Text style={styles.bigNumber}>{formatKRW(summary.expectedAnnualDividend)}</Text>
        <Text style={styles.caption}>월 평균 {formatKRW(monthlyAverage)}</Text>
      </Card>

      <Card title="월별 흐름">
        <View style={styles.chartRow}>
          {summary.dividends.map((item) => (
            <View key={item.month} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max((item.amount / maxDividend) * 100, 4)}%` }]} />
              </View>
              <Text style={styles.month}>{item.month.replace("월", "")}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="예정 캘린더">
        {(summary.dividendCalendar ?? []).slice(0, 5).map((item) => (
          <View key={item.id} style={styles.calendarRow}>
            <View>
              <Text style={styles.calendarDate}>{item.date}</Text>
              <Text style={styles.calendarStock}>{item.stock}</Text>
            </View>
            <Text style={styles.calendarType}>{item.type}</Text>
          </View>
        ))}
        {(summary.dividendCalendar ?? []).length === 0 ? <Text style={styles.bodyText}>예정된 배당 일정이 없습니다.</Text> : null}
      </Card>
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
  bigNumber: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "900",
  },
  caption: {
    color: colors.positive,
    fontSize: 14,
    fontWeight: "800",
  },
  chartRow: {
    height: 170,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
  },
  barTrack: {
    height: 126,
    width: "100%",
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  barFill: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  month: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  calendarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  calendarDate: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  calendarStock: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  calendarType: {
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.positiveSoft,
    color: colors.positive,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: "900",
  },
  bodyText: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
