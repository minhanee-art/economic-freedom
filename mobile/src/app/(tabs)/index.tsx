import { router } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows, ValueRow } from "@/components/Card";
import { EmptyHoldings } from "@/components/EmptyHoldings";
import { Notice, ProgressBar, RETIREMENT_WEB_PATH, ScreenTitle, WebLinkButton } from "@/components/Parts";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { usePensionSummary } from "@/hooks/usePensionSummary";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { colors, spacing, type } from "@/styles/theme";
import type { PensionSummary, PortfolioSummary } from "@/types";
import { formatKRW, formatPercent, formatSignedKRW, pnlArrow, pnlColor } from "@/utils/format";

/**
 * 홈. 첫 숫자는 이 제품만의 것: 올해 세액공제 남은 한도, 은퇴 시점 예상 월 현금흐름 대 목표(둘 다 서버 연금 요약 값, 가족 합산).
 * 그 아래에 고른 계좌의 평가금액·손익·자산 구성을 둔다.
 */
export default function HomeScreen() {
  const portfolio = usePortfolioSummary();
  const pension = usePensionSummary();
  const { summary, accounts, selectedAccountId, selectAccount, isLoading, error } = portfolio;
  const refreshPortfolio = portfolio.refresh;
  const refreshPension = pension.refresh;
  const refresh = useCallback(async () => {
    await Promise.all([refreshPortfolio(), refreshPension()]);
  }, [refreshPortfolio, refreshPension]);
  // 처음 쓰는 계정(이 계좌에 종목이 없고 연금 계산값도 아직 없음): 앱에서 바로 할 수 있는 '종목 추가'를
  // 웹 안내 카드들보다 먼저 보이고, 무엇을 어디서 입력하는지 3단계로 알린다.
  const firstRun =
    summary !== null &&
    summary.holdings.length === 0 &&
    pension.summary !== null &&
    pension.summary.taxCredit === null &&
    pension.summary.retirement.cashflow === null;

  return (
    <AppShell refreshing={isLoading || pension.isLoading} onRefresh={refresh}>
      <ScreenTitle>가족연금계획</ScreenTitle>

      {firstRun ? <FirstRunGuide /> : null}

      {pension.summary ? (
        <PensionOverview pension={pension.summary} portfolio={summary} />
      ) : pension.failed ? (
        <Notice>연금 요약을 불러오지 못했습니다. 당겨서 새로고침하면 다시 시도합니다.</Notice>
      ) : null}

      <View style={styles.accountSection}>
        <Text style={type.heading} accessibilityRole="header">
          {summary?.account?.name ?? "계좌"}
        </Text>
        <AccountSwitcher accounts={accounts} selectedAccountId={selectedAccountId} onSelect={selectAccount} />
      </View>

      {summary ? (
        firstRun ? (
          <Text style={[type.body, styles.muted]}>이 계좌에는 아직 종목이 없습니다. 위의 1단계부터 시작하세요.</Text>
        ) : (
          <AccountContent summary={summary} />
        )
      ) : (
        <PortfolioStatus isLoading={isLoading} error={error} onRetry={refresh} />
      )}
    </AppShell>
  );
}

const FIRST_RUN_STEPS: { title: string; body: string }[] = [
  { title: "종목 추가", body: "가지고 있는 종목의 이름과 종목코드를 이 계좌에 추가합니다." },
  { title: "매수 기록", body: "이미 산 수량과 단가를 기록하면 평가금액·손익·배당이 계산됩니다." },
  { title: "연금 계좌와 은퇴 목표", body: "웹의 연금 설계 화면에서 입력하면 세액공제와 은퇴 시점 현금흐름이 여기에 표시됩니다." },
];

/** 빈 계정의 첫 화면 안내. 1·2단계는 앱에서, 3단계는 웹에서 한다. 주 버튼은 지금 할 수 있는 1단계 하나. */
function FirstRunGuide() {
  return (
    <Card title="처음 시작하기">
      <View style={styles.steps}>
        {FIRST_RUN_STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <Text style={[type.number, styles.stepNo]}>{index + 1}</Text>
            <View style={styles.stepText}>
              <Text style={[type.body, styles.stepTitle]}>{step.title}</Text>
              <Text style={[type.label, styles.stepBody]}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Button label="종목 추가" onPress={() => router.push("/add-holding")} />
    </Card>
  );
}

function PensionOverview({ pension, portfolio }: { pension: PensionSummary; portfolio: PortfolioSummary | null }) {
  const { taxCredit, retirement } = pension;
  const cashflow = retirement.cashflow;
  const family = (taxCredit?.byOwner.length ?? 0) > 1;
  // 목표를 저장하지 않은 계정에는 서버 기본값(300만원)을 목표처럼 보이지 않는다.
  const savedTarget = portfolio && portfolio.targetMonthlyCashflowIsDefault === false ? portfolio.targetMonthlyCashflow : null;
  const goalMissing = retirement.missingFields.includes("targetMonthly");

  return (
    <>
      <Card title={`${pension.year}년 세액공제`} aside={family ? "가족 합산" : undefined}>
        {taxCredit ? (
          <>
            <View style={styles.headline}>
              <Text style={type.label}>남은 공제 한도</Text>
              <Text style={type.numberLg}>{formatKRW(taxCredit.progress.remainingCreditRoom)}</Text>
            </View>
            <ProgressBar pct={taxCredit.progress.progressPct} label="공제 한도 대비 납입 진행률" />
            <Text style={[type.label, styles.tabular]}>
              한도 대비 납입 {taxCredit.progress.progressPct.toFixed(1)}% · 예상 공제액 {formatKRW(taxCredit.progress.estimatedCredit)}
            </Text>
          </>
        ) : (
          <>
            <Text style={[type.body, styles.muted]}>
              {pension.taxCreditUnavailableReason === "only_excluded_owner_accounts"
                ? "연금 계좌가 모두 자녀·기타 명의라 세액공제를 계산하지 않았습니다."
                : "연금저축·IRP·DC·ISA 계좌가 없어 세액공제를 계산하지 않았습니다."}
            </Text>
            <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 연금 계좌 등록" />
          </>
        )}
      </Card>

      <Card title="은퇴 시점 예상 월 현금흐름" aside={cashflow ? `${cashflow.atRetirement.age}세` : undefined}>
        {cashflow ? (
          <>
            <View style={styles.headline}>
              <Text style={type.numberLg}>월 {formatKRW(cashflow.atRetirement.total)}</Text>
              <Text style={[type.label, styles.tabular]}>
                {savedTarget !== null ? `목표 월 ${formatKRW(savedTarget)} 대비 ` : "목표 대비 "}
                {cashflow.coveragePctAtRetirement}%
              </Text>
            </View>
            <ProgressBar pct={cashflow.coveragePctAtRetirement} label="은퇴 목표 대비 충족률" />
            <Text style={type.caption}>공적·퇴직·개인연금과 배당을 합친 추정값입니다. 항목별 금액은 연금 탭에 있습니다.</Text>
          </>
        ) : (
          <>
            <Text style={type.numberLg}>{goalMissing ? "목표 미설정" : "계산 전"}</Text>
            <Text style={[type.body, styles.muted]}>
              {goalMissing
                ? "목표 월 생활비·은퇴 나이·출생연도를 입력하면 은퇴 시점 현금흐름을 계산합니다."
                : "은퇴 목표가 모두 입력되지 않아 계산하지 않았습니다."}
            </Text>
            <WebLinkButton path={RETIREMENT_WEB_PATH} label="웹에서 은퇴 목표 입력" />
          </>
        )}
      </Card>
    </>
  );
}

function AccountContent({ summary }: { summary: PortfolioSummary }) {
  if (summary.holdings.length === 0) {
    return (
      <EmptyHoldings description="이 계좌에 종목을 추가하고 이미 산 수량과 단가를 기록하면 평가금액·손익·배당 현금흐름이 여기에 계산됩니다." />
    );
  }
  const totalPnL = summary.totalPnL ?? summary.totalValue - summary.totalCost;
  const totalPnLPct = summary.totalPnLPct ?? (summary.totalCost > 0 ? (totalPnL / summary.totalCost) * 100 : 0);
  // 원가가 없으면(매수 기록 없음) 손익은 계산하지 않은 것이므로 방향 색을 쓰지 않는다. 0원도 중립.
  const hasCost = summary.totalCost > 0;
  const categories = summary.categories ?? [];

  return (
    <>
      <Card>
        <Rows>
          <ValueRow label="총 평가금액" value={formatKRW(summary.totalValue)} strong />
          <ValueRow
            label="손익"
            value={hasCost ? `${pnlArrow(totalPnL)} ${formatSignedKRW(totalPnL)} (${formatPercent(totalPnLPct)})`.trim() : "매수 기록 전"}
            valueColor={hasCost ? pnlColor(totalPnL) : colors.inkMuted}
          />
          <ValueRow label="누적 배당" value={formatKRW(summary.totalDividend)} />
        </Rows>
      </Card>

      <Card title="자산 구성">
        {categories.length === 0 ? <Text style={[type.body, styles.muted]}>보유자산을 입력하면 자산 구성이 표시됩니다.</Text> : null}
        {categories.slice(0, 5).map((item) => (
          <View key={item.name} style={styles.balanceRow}>
            <View style={styles.balanceHead}>
              <Text style={[type.body, styles.balanceName]}>{item.name}</Text>
              <Text style={type.number}>{item.currentPct.toFixed(1)}%</Text>
            </View>
            <ProgressBar pct={item.currentPct} label={`${item.name} 비중`} />
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  headline: { gap: spacing.xs },
  steps: { gap: spacing.md },
  step: { flexDirection: "row", gap: spacing.md },
  stepNo: { width: 16, color: colors.primary },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontWeight: "600" },
  stepBody: { lineHeight: 20 },
  muted: { color: colors.inkMuted },
  tabular: { fontVariant: ["tabular-nums"] },
  accountSection: { gap: spacing.sm, marginTop: spacing.sm },
  balanceRow: { gap: spacing.xs },
  balanceHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  balanceName: { flexShrink: 1 },
});
