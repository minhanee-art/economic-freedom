import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { ApiError } from "@/api/client";
import { refreshHoldingPrices } from "@/api/prices";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows } from "@/components/Card";
import { EmptyHoldings } from "@/components/EmptyHoldings";
import { FormError, ScreenTitle, StatusMessage } from "@/components/Parts";
import { PortfolioStatus } from "@/components/PortfolioStatus";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { notifyPortfolioChanged } from "@/storage/account";
import { handleUnauthorized } from "@/storage/session";
import { colors, spacing, type } from "@/styles/theme";
import type { Holding } from "@/types";
import { formatKRWFull, formatPercent, formatSignedKRW, pnlArrow, pnlColor } from "@/utils/format";

export default function HoldingsScreen() {
  const { summary, session, accounts, selectedAccountId, selectAccount, isLoading, error, refresh } = usePortfolioSummary();
  const holdings = summary?.holdings ?? [];
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceResult, setPriceResult] = useState<{ accountId: string; ok: boolean; text: string } | null>(null);
  // 다른 계좌로 바꾸면 이전 계좌의 새로고침 결과 문구는 보이지 않는다.
  const shownPriceResult = priceResult && priceResult.accountId === selectedAccountId ? priceResult : null;

  // 웹 홈의 '시세 새로고침'과 같은 API(/api/prices → PATCH /api/holdings)로 이 계좌 종목의 현재가를 갱신한다.
  const refreshPrices = async () => {
    if (priceBusy || !session || !selectedAccountId || holdings.length === 0) return;
    const accountId = selectedAccountId;
    setPriceBusy(true);
    setPriceResult(null);
    try {
      const result = await refreshHoldingPrices(
        session.token,
        accountId,
        holdings.map((h) => ({ id: h.id, code: h.code, currentPrice: h.currentPrice }))
      );
      const loaded = Object.keys(result.prices).length;
      if (loaded === 0) {
        setPriceResult({ accountId, ok: false, text: "시세를 불러오지 못했습니다. 잠시 뒤 다시 시도해주세요." });
      } else {
        const failText = result.failed.length > 0 ? ` 종목코드 ${result.failed.join(", ")}는 시세를 찾지 못했습니다.` : "";
        setPriceResult({ accountId, ok: true, text: `${loaded}개 종목의 현재가를 새로 불러왔습니다.${failText}` });
        notifyPortfolioChanged();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        if (await handleUnauthorized(session.token)) router.replace("/login");
        return;
      }
      setPriceResult({ accountId, ok: false, text: err instanceof Error ? err.message : "시세를 불러오지 못했습니다." });
    } finally {
      setPriceBusy(false);
    }
  };

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <ScreenTitle>자산</ScreenTitle>

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
        <View style={styles.priceBar}>
          <Text style={[type.caption, styles.priceNote]}>
            현재가는 마지막으로 불러온 시세입니다. 시세를 한 번도 불러오지 않은 종목은 매수 기록 단가로 평가합니다.
          </Text>
          <Button label="시세 새로고침" variant="link" compact busy={priceBusy} busyLabel="불러오는 중" onPress={refreshPrices} />
        </View>
      ) : null}
      {shownPriceResult ? (
        shownPriceResult.ok ? <StatusMessage>{shownPriceResult.text}</StatusMessage> : <FormError>{shownPriceResult.text}</FormError>
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
  priceBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  priceNote: { flex: 1 },
  action: { flexGrow: 1, flexBasis: 140 },
  row: { gap: spacing.xs, paddingVertical: spacing.md },
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: spacing.md },
  name: { flexShrink: 1, fontWeight: "600" },
  meta: { flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
});
