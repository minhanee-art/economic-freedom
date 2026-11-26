import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ApiError } from "@/api/client";
import { createPurchase, listPurchases } from "@/api/records";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { HoldingPicker, RecordAccountBanner } from "@/components/RecordParts";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { clearSelectedAccountId, notifyPortfolioChanged } from "@/storage/account";
import { clearSession } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors } from "@/styles/theme";
import type { PurchaseRecord } from "@/types";
import { formatKRW } from "@/utils/format";
import { parsePositiveInt, todayString, validateDate } from "@/utils/records";

export default function RecordPurchaseScreen() {
  const { summary, session, accounts, selectedAccountId, isLoading, error: loadError, refresh } = usePortfolioSummary();
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loaded, setLoaded] = useState<{ accountId: string; list: PurchaseRecord[] } | null>(null);
  const [recordsError, setRecordsError] = useState("");
  // state 갱신은 비동기라, 빠른 연속 탭을 막으려면 동기 잠금이 따로 필요하다.
  const submitLock = useRef(false);

  const holdings = useMemo(() => summary?.holdings ?? [], [summary]);
  const holding = holdings.find((item) => item.id === holdingId) ?? null;
  // 다른 계좌에서 불러온 목록은 보여주지 않는다.
  const records = loaded && loaded.accountId === selectedAccountId ? loaded.list : [];
  const account = accounts.find((item) => item.id === selectedAccountId);

  const handleAuthErrors = useCallback(async (err: unknown): Promise<boolean> => {
    if (err instanceof ApiError && err.status === 401) {
      await clearSession();
      router.replace("/login");
      return true;
    }
    if (err instanceof ApiError && err.status === 404) {
      // 계좌가 없어졌다: 저장된 선택을 지우고 요약을 다시 불러온다.
      await clearSelectedAccountId();
      notifyPortfolioChanged();
      setError("선택한 계좌를 찾을 수 없어 계좌 선택을 초기화했습니다. 계좌를 확인한 뒤 다시 시도해주세요.");
      return true;
    }
    return false;
  }, []);

  const loadRecords = useCallback(async () => {
    if (!session || !selectedAccountId) return;
    try {
      setLoaded({ accountId: selectedAccountId, list: await listPurchases(session.token, selectedAccountId) });
      setRecordsError("");
    } catch (err) {
      if (await handleAuthErrors(err)) return;
      setRecordsError(err instanceof Error ? err.message : "매수 기록을 불러오지 못했습니다.");
    }
  }, [session, selectedAccountId, handleAuthErrors]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleSubmit = async () => {
    if (submitLock.current || !session || !selectedAccountId || !holding) return;
    const qty = parsePositiveInt(quantity);
    const unitPrice = parsePositiveInt(price);
    const dateError = validateDate(date);
    if (qty === null) return setError("수량은 1 이상의 정수로 입력해주세요.");
    if (unitPrice === null) return setError("단가는 1원 이상의 정수로 입력해주세요.");
    if (dateError) return setError(dateError);

    submitLock.current = true;
    setIsSubmitting(true);
    setError("");
    setDone("");
    try {
      await createPurchase(session.token, selectedAccountId, {
        date: date.trim(),
        holdingId: holding.id,
        code: holding.code,
        name: holding.name,
        quantity: qty,
        price: unitPrice,
      });
      setDone(`${holding.name} ${qty.toLocaleString("ko-KR")}주 매수 기록을 추가했습니다.`);
      setQuantity("");
      setPrice("");
      notifyPortfolioChanged();
      await loadRecords();
    } catch (err) {
      if (await handleAuthErrors(err)) return;
      setError(err instanceof Error ? err.message : "매수 기록을 저장하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const total = (parsePositiveInt(quantity) ?? 0) * (parsePositiveInt(price) ?? 0);
  const disabled = isSubmitting || !holding || !quantity || !price || !date;

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.title}>매수 기록 추가</Text>
      <Text style={styles.subtitle}>이미 한 거래를 기록합니다. 주문이 실행되지 않습니다.</Text>

      <RecordAccountBanner account={account} />
      {loadError && !summary ? <Text style={styles.error}>{loadError}</Text> : null}

      <View style={{ gap: 16 }}>
        <View style={styles.field}>
          <Text style={styles.label}>종목</Text>
          <HoldingPicker holdings={holdings} selectedId={holdingId} onSelect={setHoldingId} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>수량(주)</Text>
          <TextInput inputMode="numeric" keyboardType="number-pad" onChangeText={setQuantity} style={styles.input} value={quantity} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>단가(원)</Text>
          <TextInput inputMode="numeric" keyboardType="number-pad" onChangeText={setPrice} style={styles.input} value={price} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>거래일 (YYYY-MM-DD)</Text>
          <TextInput autoCapitalize="none" onChangeText={setDate} placeholder="2026-01-31" style={styles.input} value={date} />
        </View>
        {total > 0 ? <Text style={styles.label}>기록 금액 {formatKRW(total)}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {done ? <Text style={[styles.label, { color: colors.positive }]}>{done}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={handleSubmit}
          style={[styles.button, { marginTop: 0 }, disabled && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "저장 중" : "매수 기록 추가"}</Text>
        </Pressable>
      </View>

      <View style={{ height: 24 }} />
      <Card title="최근 매수 기록">
        {recordsError ? <Text style={styles.error}>{recordsError}</Text> : null}
        {records.length === 0 && !recordsError ? <Text style={styles.helper}>아직 기록이 없습니다.</Text> : null}
        {records.map((record) => (
          <View key={record.id} style={{ gap: 2 }}>
            <Text style={styles.label}>
              {record.date} · {formatKRW(record.totalSpent)}
            </Text>
            {record.items.map((item, index) => (
              <Text key={`${record.id}-${index}`} style={styles.helper}>
                {item.name} {item.quantity.toLocaleString("ko-KR")}주 × {formatKRW(item.price)}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.helper}>매수 기록 삭제는 아직 지원하지 않습니다. 잘못 입력했다면 웹에서 확인해주세요.</Text>
      </Card>
    </AppShell>
  );
}
