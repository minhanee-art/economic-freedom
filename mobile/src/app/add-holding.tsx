import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ApiError } from "@/api/client";
import { createHolding, normalizeHoldingInput } from "@/api/holdings";
import { AppShell } from "@/components/AppShell";
import { RecordAccountBanner } from "@/components/RecordParts";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { clearSelectedAccountId, notifyPortfolioChanged } from "@/storage/account";
import { handleUnauthorized } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors, spacing } from "@/styles/theme";

/**
 * 종목 추가 — 종목명과 종목코드만 받아 현재 선택한 계좌에 0주로 넣는다.
 * 시세 조회·검색·목록 제안은 하지 않는다. 수량과 단가는 이어서 매수 기록으로 남긴다.
 */
export default function AddHoldingScreen() {
  const { summary, session, accounts, selectedAccountId, isLoading, error: loadError, refresh } = usePortfolioSummary();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ id: string; name: string; code: string } | null>(null);
  const submitLock = useRef(false);
  const account = accounts.find((item) => item.id === selectedAccountId);

  const handleSubmit = async () => {
    if (submitLock.current || !session || !selectedAccountId) return;
    const checked = normalizeHoldingInput({ name, code });
    if (!checked.ok) return setError(checked.error);
    if ((summary?.holdings ?? []).some((h) => h.code === checked.value.code)) {
      return setError("이 계좌에 이미 있는 종목코드입니다.");
    }

    submitLock.current = true;
    setIsSubmitting(true);
    // 직전에 추가한 종목 안내(매수 기록으로 이동)는 다음 추가가 성공할 때까지 남긴다
    setError("");
    try {
      const { id } = await createHolding(session.token, selectedAccountId, checked.value);
      setAdded({ id, ...checked.value });
      setName("");
      setCode("");
      notifyPortfolioChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        if (await handleUnauthorized(session.token)) router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        await clearSelectedAccountId();
        notifyPortfolioChanged();
        setError("선택한 계좌를 찾을 수 없어 계좌 선택을 초기화했습니다. 계좌를 확인한 뒤 다시 시도해주세요.");
        return;
      }
      setError(err instanceof Error ? err.message : "종목을 추가하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const disabled = isSubmitting || !session || !selectedAccountId || !name.trim() || !code.trim();

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={styles.subtitle}>
        가지고 있는 종목의 이름과 종목코드를 입력해 이 계좌에 추가합니다. 수량과 단가는 추가한 뒤 매수 기록으로 남깁니다.
      </Text>

      <RecordAccountBanner account={account} label="추가할 계좌" />
      {loadError && !summary ? <Text style={styles.error}>{loadError}</Text> : null}

      <View style={{ gap: 16 }}>
        <View style={styles.field}>
          <Text style={styles.label}>종목명</Text>
          <TextInput
            accessibilityLabel="종목명"
            autoCorrect={false}
            maxLength={100}
            onChangeText={setName}
            placeholder="증권사 앱에 표시된 이름"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
            value={name}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>종목코드</Text>
          <TextInput
            accessibilityLabel="종목코드"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            onChangeText={setCode}
            placeholder="숫자·영문 12자 이하"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
            value={code}
          />
          <Text style={[styles.helper, { marginTop: 0 }]}>증권사 앱의 종목 상세나 거래내역에 나오는 코드입니다.</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={handleSubmit}
          style={[styles.button, { marginTop: 0 }, disabled && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "추가 중" : "종목 추가"}</Text>
        </Pressable>
      </View>

      {added ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text style={[styles.label, { color: colors.positive }]}>
            {added.name}({added.code})을(를) 0주로 추가했습니다.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace({ pathname: "/record-purchase", params: added.id ? { holdingId: added.id } : {} })}
            style={[styles.button, { marginTop: 0, backgroundColor: colors.primary }]}
          >
            <Text style={styles.buttonText}>이 종목의 매수 기록 추가</Text>
          </Pressable>
        </View>
      ) : null}
    </AppShell>
  );
}
