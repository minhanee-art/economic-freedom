import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, radius, spacing } from "@/styles/theme";
import { formatKRW, formatPercent } from "@/utils/format";

export default function HomeScreen() {
  const { summary, session, isLoading, error, isDemo, refresh } = usePortfolioSummary();
  const totalPnL = summary.totalPnL ?? summary.totalValue - summary.totalCost;
  const totalPnLPct = summary.totalPnLPct ?? (summary.totalCost > 0 ? (totalPnL / summary.totalCost) * 100 : 0);
  const monthlyCashflow = summary.expectedAnnualDividend / 12;
  const cashflowProgress = Math.round((monthlyCashflow / summary.targetMonthlyCashflow) * 100);
  const isPositive = totalPnL >= 0;

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>경제적 자유</Text>
          <Text style={styles.accountName}>{session ? summary.account?.name ?? "내 포트폴리오" : "샘플 포트폴리오"}</Text>
        </View>
        {isDemo ? (
          <Link href="/login" asChild>
            <Pressable style={styles.loginButton}>
              <Text style={styles.loginButtonText}>로그인</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>

      {error ? <Text style={styles.notice}>{error}</Text> : null}

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>총 평가금액</Text>
        <Text style={styles.heroValue}>{formatKRW(summary.totalValue)}</Text>
        <View style={styles.pnlPill}>
          <Text style={[styles.pnlText, { color: isPositive ? colors.positive : colors.negative }]}>
            {formatKRW(totalPnL)} {formatPercent(totalPnLPct)}
          </Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard label="누적 배당" value={formatKRW(summary.totalDividend)} trend="up" />
        <MetricCard label="월 적립금" value={formatKRW(summary.monthlyBudget)} />
        <MetricCard label="월 현금흐름" value={formatKRW(monthlyCashflow)} caption={`목표 대비 ${cashflowProgress}%`} trend="up" />
        <MetricCard label="보유 종목" value={`${summary.holdings.length}개`} />
      </View>

      <Card title="은퇴 현금흐름" action={`${cashflowProgress}%`}>
        <Text style={styles.cardHeadline}>목표 월 {formatKRW(summary.targetMonthlyCashflow)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(Math.max(cashflowProgress, 0), 100)}%` }]} />
        </View>
        <Text style={styles.cardText}>배당과 분배금 중심으로 은퇴 현금흐름 달성률을 추적합니다.</Text>
      </Card>

      <Card title="자산 구성">
        {(summary.categories ?? []).slice(0, 4).map((item) => (
          <View key={item.name} style={styles.balanceRow}>
            <Text style={styles.balanceName}>{item.name}</Text>
            <View style={styles.balanceTrack}>
              <View style={[styles.balanceFill, { width: `${Math.min(item.currentPct, 100)}%` }]} />
            </View>
            <Text style={styles.balancePct}>{item.currentPct.toFixed(1)}%</Text>
          </View>
        ))}
        {(summary.categories ?? []).length === 0 ? <Text style={styles.cardText}>보유자산을 입력하면 자산 구성이 표시됩니다.</Text> : null}
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  appName: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  accountName: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  loginButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  loginButtonText: {
    color: colors.surface,
    fontWeight: "900",
  },
  notice: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.negativeSoft,
    color: colors.negative,
    padding: spacing.md,
    fontSize: 13,
    fontWeight: "800",
  },
  hero: {
    gap: spacing.md,
    borderRadius: 30,
    backgroundColor: colors.brandDark,
    padding: spacing.xl,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 13,
    fontWeight: "800",
  },
  heroValue: {
    color: colors.surface,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  pnlPill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pnlText: {
    fontSize: 13,
    fontWeight: "900",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  cardHeadline: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  cardText: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  progressTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  balanceName: {
    width: 72,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  balanceTrack: {
    flex: 1,
    height: 8,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  balanceFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  balancePct: {
    width: 48,
    color: colors.inkMuted,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
});
