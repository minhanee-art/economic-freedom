import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Text } from "react-native";
import { deleteAccount, getPasswordStatus } from "@/api/auth";
import { ApiError, webUrl } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/Field";
import { FormError } from "@/components/Parts";
import { clearSession, handleUnauthorized, loadSession } from "@/storage/session";
import { colors, type } from "@/styles/theme";
import { confirmDestructive } from "@/utils/confirm";

export default function DeleteAccountScreen() {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  // null: 확인 중. false면 Google 전용 계정이라 비밀번호 대신 이메일로 확인한다.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const guideUrl = webUrl("/account-deletion");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const value = await getPasswordStatus(session.token);
        if (!cancelled) setHasPassword(value);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          if (await handleUnauthorized(session.token)) router.replace("/login");
          return;
        }
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const performDelete = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const session = await loadSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        await deleteAccount(session.token, hasPassword === false ? { confirmEmail: email.trim() } : { password });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          if (await handleUnauthorized(session.token)) router.replace("/login");
          return;
        }
        throw err;
      }
      await clearSession();
      router.replace("/login");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = () => {
    // 버튼을 처음부터 막지 않는다 — 비어 있으면 칸 아래에 이유를 보인다.
    if (hasPassword === false ? !email.trim() : !password) {
      setFieldError(hasPassword === false ? "가입한 이메일 주소를 입력해주세요." : "현재 비밀번호를 입력해주세요.");
      return;
    }
    setFieldError("");
    confirmDestructive({
      title: "정말 계정을 삭제할까요?",
      message: "계정과 모든 포트폴리오 데이터가 영구 삭제되며 되돌릴 수 없습니다.",
      confirmText: "계정 삭제",
      onConfirm: () => void performDelete(),
    });
  };

  return (
    <AppShell>
      <Text style={[type.body, { color: colors.danger }]}>계정을 삭제하면 저장된 모든 데이터가 영구적으로 사라지며 복구할 수 없습니다.</Text>

      <Card title={hasPassword === false ? "이메일 확인" : "비밀번호 확인"}>
        {hasPassword === false ? (
          <TextField
            label="계정 이메일"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={(text) => {
              setEmail(text);
              setFieldError("");
            }}
            placeholder="가입한 이메일 주소"
            value={email}
            error={fieldError}
            returnKeyType="done"
            onSubmitEditing={confirmDelete}
          />
        ) : (
          <TextField
            label="비밀번호"
            autoComplete="current-password"
            editable={hasPassword !== null}
            onChangeText={(text) => {
              setPassword(text);
              setFieldError("");
            }}
            placeholder="현재 비밀번호"
            secureTextEntry
            value={password}
            error={fieldError}
            returnKeyType="done"
            onSubmitEditing={confirmDelete}
          />
        )}
        {error ? <FormError>{error}</FormError> : null}
        <Button
          label="계정 영구 삭제"
          variant="danger"
          busy={isSubmitting || hasPassword === null}
          busyLabel={isSubmitting ? "삭제 중" : "확인 중"}
          onPress={confirmDelete}
        />
      </Card>

      {guideUrl ? (
        <Button label="계정 삭제 안내 보기" variant="link" accessibilityRole="link" onPress={() => Linking.openURL(guideUrl)} />
      ) : null}
    </AppShell>
  );
}
