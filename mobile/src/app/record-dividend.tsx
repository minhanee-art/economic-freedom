import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { Text } from "@/components/AppText";
import { ApiError } from "@/api/client";
import { createDividend, deleteDividend, listDividends } from "@/api/records";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, Rows } from "@/components/Card";
import { DateField, TextField } from "@/components/Field";
import { FormError, Notice, StatusMessage } from "@/components/Parts";
import { HoldingPicker, RecordAccountBanner } from "@/components/RecordParts";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { clearSelectedAccountId, notifyPortfolioChanged } from "@/storage/account";
import { handleUnauthorized } from "@/storage/session";
import { spacing, type } from "@/styles/theme";
import type { DividendRecord } from "@/types";
import { confirmDestructive } from "@/utils/confirm";
import { formatKRWFull } from "@/utils/format";
import { parsePositiveInt, todayString, validateDate } from "@/utils/records";

type Errors = { holding?: string; amount?: string; date?: string };

export default function RecordDividendScreen() {
  const { summary, session, accounts, selectedAccountId, isLoading, error: loadError, refresh } = usePortfolioSummary();
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loaded, setLoaded] = useState<{ accountId: string; list: DividendRecord[] } | null>(null);
  const [recordsError, setRecordsError] = useState("");
  const submitLock = useRef(false);
  const dateRef = useRef<TextInput>(null);

  const holdings = useMemo(() => summary?.holdings ?? [], [summary]);
  const holding = holdings.find((item) => item.id === holdingId) ?? null;
  const noHoldings = summary != null && holdings.length === 0;
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
      setLoaded({ accountId: selectedAccountId, list: (await listDividends(session.token, selectedAccountId)).slice(0, 10) });
      setRecordsError("");
    } catch (err) {
      if (await handleAuthErrors(err, session.token)) return;
      setRecordsError(err instanceof Error ? err.message : "배당 수령 기록을 불러오지 못했습니다.");
    }
  }, [session, selectedAccountId, handleAuthErrors]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleSubmit = async () => {
    if (submitLock.current) return;
    setDone("");
    setError("");
    const won = parsePositiveInt(amount);
    const found: Errors = {};
    if (!holding) found.holding = "배당을 받은 종목을 골라주세요.";
    if (won === null) found.amount = amount ? "금액은 1원 이상의 정수로 입력해주세요." : "수령 금액을 입력해주세요.";
    const dateError = validateDate(date);
    if (dateError) found.date = dateError;
    setErrors(found);
    if (Object.keys(found).length > 0 || !holding || won === null) return;
    if (!session || !selectedAccountId) {
      setError("계좌 정보를 아직 불러오지 못했습니다. 잠시 뒤 다시 시도해주세요.");
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
    try {
      await createDividend(session.token, selectedAccountId, { holdingId: holding.id, amount: won, date: date.trim() });
      setDone(`${holding.name} 배당 수령 ${formatKRWFull(won)}을 기록했습니다.`);
      setAmount("");
      notifyPortfolioChanged();
      await loadRecords();
    } catch (err) {
      if (await handleAuthErrors(err, session.token)) return;
      setError(err instanceof Error ? err.message : "배당 수령 기록을 저장하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const performDelete = async (record: DividendRecord) => {
    if (submitLock.current || !session || !selectedAccountId) return;
    submitLock.current = true;
    setDeletingId(record.id);
    setError("");
    setDone("");
    try {
      await deleteDividend(session.token, selectedAccountId, record.id);
      setDone(`${record.date} 배당 수령 기록을 삭제했습니다.`);
      notifyPortfolioChanged();
      await loadRecords();
    } catch (err) {
      if (await handleAuthErrors(err, session.token)) return;
      setError(err instanceof Error ? err.message : "배당 수령 기록을 삭제하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setDeletingId(null);
    }
  };

  const confirmDelete = (record: DividendRecord) => {
    confirmDestructive({
      title: "기록 삭제",
      message: `${record.date} ${record.holdingName ?? ""} ${formatKRWFull(record.amount)} 기록을 삭제할까요?`,
      confirmText: "삭제",
      onConfirm: () => void performDelete(record),
    });
  };

  const hasSameDay = !!holding && records.some((r) => r.holdingId === holding.id && r.date === date.trim());

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={type.label}>이미 받은 배당을 기록합니다.</Text>

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
      {/* 종목이 없는 계좌는 위의 빈 상태(종목 추가)만 보인다 — 고를 종목이 없는데 입력칸·저장 버튼을 두지 않는다. */}
      {noHoldings ? null : (
        <>
          <TextField
            label="수령 금액(원)"
            inputMode="numeric"
            keyboardType="number-pad"
            placeholder="세후 입금액, 예: 12000"
            onChangeText={(text) => {
              setAmount(text);
              clearError("amount");
            }}
            value={amount}
            error={errors.amount}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => dateRef.current?.focus()}
          />
          <DateField
            ref={dateRef}
            label="수령일"
            value={date}
            onChange={(next) => {
              setDate(next);
              clearError("date");
            }}
            error={errors.date}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {hasSameDay ? <Notice tone="caution">같은 종목·같은 날짜의 기록이 이미 있으면 새 금액으로 덮어씁니다.</Notice> : null}
          {error ? <FormError>{error}</FormError> : null}
          {done ? <StatusMessage>{done}</StatusMessage> : null}
          <Button label="기록 저장" busy={isSubmitting} busyLabel="저장 중" disabled={deletingId !== null} onPress={handleSubmit} />

          <Card title="최근 배당 수령 기록">
            {recordsError ? <FormError>{recordsError}</FormError> : null}
            {records.length === 0 && !recordsError ? <Text style={type.caption}>아직 기록이 없습니다.</Text> : null}
            <Rows>
              {records.map((record) => (
                <View key={record.id} style={styles.recordRow}>
                  <View style={styles.recordMain}>
                    <Text style={type.body}>{record.holdingName ?? "종목"}</Text>
                    <Text style={[type.caption, styles.tabular]}>
                      {record.date} · {formatKRWFull(record.amount)}
                    </Text>
                  </View>
                  <Button
                    label="삭제"
                    // 목록의 삭제는 잉크색 테두리 버튼 — 빨강은 손익(이익)과 겹치므로 확인 단계(대화상자)에만 쓴다.
                    variant="secondary"
                    compact
                    accessibilityLabel={`${record.date} ${record.holdingName ?? "종목"} 배당 기록 삭제`}
                    busy={deletingId === record.id}
                    busyLabel="삭제 중"
                    disabled={deletingId !== null || isSubmitting}
                    onPress={() => confirmDelete(record)}
                  />
                </View>
              ))}
            </Rows>
          </Card>
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  recordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm },
  recordMain: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
});
