import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { ApiError } from "@/api/client";
import { createDividend, deleteDividend, listDividends } from "@/api/records";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { HoldingPicker, RecordAccountBanner } from "@/components/RecordParts";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { clearSelectedAccountId, notifyPortfolioChanged } from "@/storage/account";
import { clearSession } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors } from "@/styles/theme";
import type { DividendRecord } from "@/types";
import { formatKRW } from "@/utils/format";
import { parsePositiveInt, todayString, validateDate } from "@/utils/records";

export default function RecordDividendScreen() {
  const { summary, session, accounts, selectedAccountId, isLoading, error: loadError, refresh } = usePortfolioSummary();
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loaded, setLoaded] = useState<{ accountId: string; list: DividendRecord[] } | null>(null);
  const [recordsError, setRecordsError] = useState("");
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
      if (await handleAuthErrors(err)) return;
      setRecordsError(err instanceof Error ? err.message : "배당 수령 기록을 불러오지 못했습니다.");
    }
  }, [session, selectedAccountId, handleAuthErrors]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleSubmit = async () => {
    if (submitLock.current || !session || !selectedAccountId || !holding) return;
    const won = parsePositiveInt(amount);
    const dateError = validateDate(date);
    if (won === null) return setError("금액은 1원 이상의 정수로 입력해주세요.");
    if (dateError) return setError(dateError);

    submitLock.current = true;
    setIsSubmitting(true);
    setError("");
    setDone("");
    try {
      await createDividend(session.token, selectedAccountId, { holdingId: holding.id, amount: won, date: date.trim() });
      setDone(`${holding.name} 배당 수령 ${formatKRW(won)}을 기록했습니다.`);
      setAmount("");
      notifyPortfolioChanged();
      await loadRecords();
    } catch (err) {
      if (await handleAuthErrors(err)) return;
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
      notifyPortfolioChanged();
      await loadRecords();
    } catch (err) {
      if (await handleAuthErrors(err)) return;
      setError(err instanceof Error ? err.message : "배당 수령 기록을 삭제하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setDeletingId(null);
    }
  };

  const confirmDelete = (record: DividendRecord) => {
    Alert.alert("기록 삭제", `${record.date} ${record.holdingName ?? ""} ${formatKRW(record.amount)} 기록을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void performDelete(record) },
    ]);
  };

  const disabled = isSubmitting || !holding || !amount || !date;
  const hasSameDay = !!holding && records.some((r) => r.holdingId === holding.id && r.date === date.trim());

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.title}>배당 수령 기록 추가</Text>
      <Text style={styles.subtitle}>이미 받은 배당을 기록합니다.</Text>

      <RecordAccountBanner account={account} />
      {loadError && !summary ? <Text style={styles.error}>{loadError}</Text> : null}

      <View style={{ gap: 16 }}>
        <View style={styles.field}>
          <Text style={styles.label}>종목</Text>
          <HoldingPicker holdings={holdings} selectedId={holdingId} onSelect={setHoldingId} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>수령 금액(원)</Text>
          <TextInput inputMode="numeric" keyboardType="number-pad" onChangeText={setAmount} style={styles.input} value={amount} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>수령일 (YYYY-MM-DD)</Text>
          <TextInput autoCapitalize="none" onChangeText={setDate} placeholder="2026-01-31" style={styles.input} value={date} />
        </View>
        {hasSameDay ? (
          <Text style={styles.helper}>같은 종목·같은 날짜의 기록이 이미 있으면 새 금액으로 덮어씁니다.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {done ? <Text style={[styles.label, { color: colors.positive }]}>{done}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={handleSubmit}
          style={[styles.button, { marginTop: 0 }, disabled && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "저장 중" : "배당 수령 기록 추가"}</Text>
        </Pressable>
      </View>

      <View style={{ height: 24 }} />
      <Card title="최근 배당 수령 기록">
        {recordsError ? <Text style={styles.error}>{recordsError}</Text> : null}
        {records.length === 0 && !recordsError ? <Text style={styles.helper}>아직 기록이 없습니다.</Text> : null}
        {records.map((record) => (
          <View key={record.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.label}>{record.holdingName ?? "종목"}</Text>
              <Text style={styles.helper}>
                {record.date} · {formatKRW(record.amount)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={deletingId !== null}
              onPress={() => confirmDelete(record)}
              hitSlop={8}
            >
              <Text style={[styles.linkText, { color: colors.negative }]}>{deletingId === record.id ? "삭제 중" : "삭제"}</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </AppShell>
  );
}
