import { router } from "expo-router";
import { useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import { Text } from "@/components/AppText";
import { ApiError } from "@/api/client";
import { createHolding, normalizeHoldingInput } from "@/api/holdings";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { FormError, StatusMessage } from "@/components/Parts";
import { RecordAccountBanner } from "@/components/RecordParts";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { clearSelectedAccountId, notifyPortfolioChanged } from "@/storage/account";
import { handleUnauthorized } from "@/storage/session";
import { spacing, type } from "@/styles/theme";

type Errors = { name?: string; code?: string };

/**
 * 종목 추가 — 종목명과 종목코드만 받아 현재 선택한 계좌에 0주로 넣는다.
 * 시세 조회·검색·목록 제안은 하지 않는다. 수량과 단가는 이어서 매수 기록으로 남긴다.
 */
export default function AddHoldingScreen() {
  const { summary, session, accounts, selectedAccountId, isLoading, error: loadError, refresh } = usePortfolioSummary();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ id: string; name: string; code: string } | null>(null);
  const submitLock = useRef(false);
  const codeRef = useRef<TextInput>(null);
  const account = accounts.find((item) => item.id === selectedAccountId);

  // 새 입력을 시작하면 직전 추가 결과(성공 문구·'이 종목의 매수 기록 추가')를 지운다 — 새 오류와 한 화면에 섞이지 않게.
  const changeName = (text: string) => {
    setName(text);
    setAdded(null);
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };
  const changeCode = (text: string) => {
    setCode(text);
    setAdded(null);
    if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
  };

  const handleSubmit = async () => {
    if (submitLock.current) return;
    setAdded(null);
    setError("");
    const checked = normalizeHoldingInput({ name, code });
    if (!checked.ok) {
      setErrors(checked.error.startsWith("종목명") ? { name: checked.error } : { code: checked.error });
      return;
    }
    if ((summary?.holdings ?? []).some((h) => h.code === checked.value.code)) {
      setErrors({ code: "이 계좌에 이미 있는 종목코드입니다." });
      return;
    }
    setErrors({});
    if (!session || !selectedAccountId) {
      setError("계좌 정보를 아직 불러오지 못했습니다. 잠시 뒤 다시 시도해주세요.");
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
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
      if (err instanceof ApiError && err.status === 409) {
        // 서버가 같은 종목코드를 거절했다(요약을 다시 받기 전이라 앱 사전 확인을 지나친 경우) — 종목코드 칸 아래에 보인다.
        setErrors({ code: err.message });
        return;
      }
      setError(err instanceof Error ? err.message : "종목을 추가하지 못했습니다.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell refreshing={isLoading} onRefresh={refresh}>
      <Text style={type.label}>
        가지고 있는 종목의 이름과 종목코드를 입력해 이 계좌에 추가합니다. 수량과 단가는 추가한 뒤 매수 기록으로 남깁니다.
      </Text>

      <RecordAccountBanner account={account} label="추가할 계좌" />
      {loadError && !summary ? <FormError>{loadError}</FormError> : null}

      <TextField
        label="종목명"
        autoCorrect={false}
        maxLength={100}
        onChangeText={changeName}
        placeholder="증권사 앱에 표시된 이름"
        value={name}
        error={errors.name}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => codeRef.current?.focus()}
      />
      <TextField
        ref={codeRef}
        label="종목코드"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        onChangeText={changeCode}
        placeholder="숫자·영문 12자 이하"
        value={code}
        error={errors.code}
        helper="증권사 앱의 종목 상세나 거래내역에 나오는 코드입니다."
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      {error ? <FormError>{error}</FormError> : null}
      <Button label="종목 추가" busy={isSubmitting} busyLabel="추가 중" onPress={handleSubmit} />

      {added ? (
        <View style={{ gap: spacing.sm }}>
          <StatusMessage>{`${added.name}(${added.code})을(를) 0주로 추가했습니다.`}</StatusMessage>
          <Button
            label="이 종목의 매수 기록 추가"
            variant="secondary"
            onPress={() => router.replace({ pathname: "/record-purchase", params: added.id ? { holdingId: added.id } : {} })}
          />
        </View>
      ) : null}
    </AppShell>
  );
}
