import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { Text } from "@/components/AppText";
import { ApiError } from "@/api/client";
import { createPurchase, deletePurchase, listPurchases, PurchaseNotFoundError } from "@/api/records";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows } from "@/components/Card";
import { DateField, TextField } from "@/components/Field";
import { FormError, StatusMessage } from "@/components/Parts";
import { HoldingPicker, RecordAccountBanner } from "@/components/RecordParts";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { clearSelectedAccountId, notifyPortfolioChanged } from "@/storage/account";
import { handleUnauthorized } from "@/storage/session";
import { spacing, type } from "@/styles/theme";
import type { PurchaseRecord } from "@/types";
import { confirmDestructive } from "@/utils/confirm";
import { formatKRWFull } from "@/utils/format";
import { INT_MAX, parsePositiveInt, todayString, validateDate } from "@/utils/records";

type Errors = { holding?: string; quantity?: string; price?: string; date?: string };

export default function RecordPurchaseScreen() {
  const { summary, session, accounts, selectedAccountId, isLoading, error: loadError, refresh } = usePortfolioSummary();
  // 종목 추가 화면에서 넘어오면 방금 추가한 종목을 미리 고른다
  const params = useLocalSearchParams<{ holdingId?: string }>();
  const [holdingId, setHoldingId] = useState<string | null>(typeof params.holdingId === "string" ? params.holdingId : null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loaded, setLoaded] = useState<{ accountId: string; list: PurchaseRecord[] } | null>(null);
  const [recordsError, setRecordsError] = useState("");
  // state 갱신은 비동기라, 빠른 연속 탭을 막으려면 동기 잠금이 따로 필요하다.
  const submitLock = useRef(false);
  const priceRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput>(null);

  const holdings = useMemo(() => summary?.holdings ?? [], [summary]);
  const holding = holdings.find((item) => item.id === holdingId) ?? null;
  // 다른 계좌에서 불러온 목록은 보여주지 않는다.
  const records = loaded && loaded.accountId === selectedAccountId ? loaded.list : [];
  const account = accounts.find((item) => item.id === selectedAccountId);

  const clearError = (key: keyof Errors) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleAuthErrors = useCallback(async (err: unknown, sentToken: string): Promise<boolean> => {
    if (err instanceof ApiError && err.status === 401) {
      // 토큰이 바뀐 뒤 늦게 온 이전 토큰의 401이면 세션을 유지하고 오류만 조용히 넘긴다.
      if (await handleUnauthorized(sentToken)) router.replace("/login");
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
      if (await handleAuthErrors(err, session.token)) return;
      setRecordsError(err instanceof Error ? err.message : "매수 기록을 불러오지 못했습니다.");
    }
  }, [session, selectedAccountId, handleAuthErrors]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleSubmit = async () => {
    if (submitLock.current) return;
    setDone("");
    setError("");
    // 저장 버튼은 처음부터 막지 않는다 — 누르면 모자란 항목을 칸마다 알려 준다.
    const qty = parsePositiveInt(quantity);
    const unitPrice = parsePositiveInt(price);
    const found: Errors = {};
    if (!holding) found.holding = "기록할 종목을 골라주세요.";
    if (qty === null) found.quantity = quantity ? "수량은 1 이상의 정수로 입력해주세요." : "수량을 입력해주세요.";
    if (unitPrice === null) found.price = price ? "단가는 1원 이상의 정수로 입력해주세요." : "단가를 입력해주세요.";
    const dateError = validateDate(date);
    if (dateError) found.date = dateError;
    if (qty !== null && unitPrice !== null && qty * unitPrice > INT_MAX) found.price = "기록 금액(수량 × 단가)이 너무 큽니다.";
    setErrors(found);
    if (Object.keys(found).length > 0 || !holding || qty === null || unitPrice === null) return;
    if (!session || !selectedAccountId) {
      setError("계좌 정보를 아직 불러오지 못했습니다. 잠시 뒤 다시 시도해주세요.");
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
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
      if (await handleAuthErrors(err, session.token)) return;
      setError(err instanceof Error ? err.message : "매수 기록을 저장하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const performDelete = async (record: PurchaseRecord) => {
    if (submitLock.current || !session || !selectedAccountId) return;
    submitLock.current = true;
    setDeletingId(record.id);
    setError("");
    setDone("");
    try {
      await deletePurchase(session.token, selectedAccountId, record.id);
      setDone(`${record.date} 매수 기록을 삭제했습니다.`);
      notifyPortfolioChanged();
      await loadRecords();
    } catch (err) {
      if (err instanceof PurchaseNotFoundError) {
        // 기록이 이미 없다(다른 기기·웹에서 삭제 등). 계좌 선택은 건드리지 않고 목록만 새로고침한다.
        setError("이미 삭제되었거나 없는 기록입니다. 목록을 새로 불러왔습니다.");
        notifyPortfolioChanged();
        await loadRecords();
        return;
      }
      if (await handleAuthErrors(err, session.token)) return;
      // 409는 서버 문구(보유 종목 편집에서 수정하라는 안내 포함)를 그대로 보여준다.
      setError(err instanceof Error ? err.message : "매수 기록을 삭제하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setDeletingId(null);
    }
  };

  const confirmDelete = (record: PurchaseRecord) => {
    confirmDestructive({
      title: "기록 삭제",
      message: `${record.date} ${formatKRWFull(record.totalSpent)} 매수 기록을 삭제할까요? 보유 수량과 원가가 이 기록 입력 전 상태로 되돌아갑니다.`,
      confirmText: "삭제",
      onConfirm: () => void performDelete(record),
    });
  };

  const total = (parsePositiveInt(quantity) ?? 0) * (parsePositiveInt(price) ?? 0);

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={type.label}>이미 한 거래를 기록합니다. 주문이 실행되지 않습니다.</Text>

      <RecordAccountBanner account={account} />
      {loadError && !summary ? <FormError>{loadError}</FormError> : null}

      <HoldingPicker
        label="종목"
        holdings={holdings}
        loaded={summary != null}
        selectedId={holdingId}
        onSelect={(id) => {
          setHoldingId(id);
          clearError("holding");
        }}
        error={errors.holding}
      />
      <TextField
        label="수량(주)"
        inputMode="numeric"
        keyboardType="number-pad"
        placeholder="예: 10"
        onChangeText={(text) => {
          setQuantity(text);
          clearError("quantity");
        }}
        value={quantity}
        error={errors.quantity}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => priceRef.current?.focus()}
      />
      <TextField
        ref={priceRef}
        label="단가(원)"
        inputMode="numeric"
        keyboardType="number-pad"
        placeholder="예: 10000"
        onChangeText={(text) => {
          setPrice(text);
          clearError("price");
        }}
        value={price}
        error={errors.price}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => dateRef.current?.focus()}
      />
      <DateField
        ref={dateRef}
        label="거래일"
        value={date}
        onChange={(next) => {
          setDate(next);
          clearError("date");
        }}
        error={errors.date}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      {total > 0 ? <Text style={type.number}>기록 금액 {formatKRWFull(total)}</Text> : null}
      {error ? <FormError>{error}</FormError> : null}
      {done ? <StatusMessage>{done}</StatusMessage> : null}
      <Button label="기록 저장" busy={isSubmitting} busyLabel="저장 중" disabled={deletingId !== null} onPress={handleSubmit} />

      <Card title="최근 매수 기록">
        {recordsError ? <FormError>{recordsError}</FormError> : null}
        {records.length === 0 && !recordsError ? <Text style={type.caption}>아직 기록이 없습니다.</Text> : null}
        <Rows>
          {records.map((record) => (
            <View key={record.id} style={styles.recordRow}>
              <View style={styles.recordMain}>
                <Text style={type.number}>
                  {record.date} · {formatKRWFull(record.totalSpent)}
                </Text>
                {record.items.map((item, index) => (
                  <Text key={`${record.id}-${index}`} style={[type.caption, styles.tabular]}>
                    {item.name} {item.quantity.toLocaleString("ko-KR")}주 × {formatKRWFull(item.price)}
                  </Text>
                ))}
              </View>
              <Button
                label="삭제"
                variant="dangerLink"
                busy={deletingId === record.id}
                busyLabel="삭제 중"
                disabled={deletingId !== null || isSubmitting}
                onPress={() => confirmDelete(record)}
              />
            </View>
          ))}
        </Rows>
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  recordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm },
  recordMain: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
});
