import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import { changePassword, getPasswordStatus } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/Field";
import { FormError, StatusMessage } from "@/components/Parts";
import { handleUnauthorized, saveSession } from "@/storage/session";
import { spacing } from "@/styles/theme";
import type { AuthSession } from "@/types";

type Errors = { current?: string; next?: string; confirm?: string };

/** 설정 탭의 비밀번호 변경(Google 전용 계정이면 설정) 카드. */
export function PasswordCard({ session, onSessionChange }: { session: AuthSession; onSessionChange: (next: AuthSession) => void }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const onUnauthorized = async (sentToken: string) => {
    if (await handleUnauthorized(sentToken)) router.replace("/login");
  };

  useEffect(() => {
    let cancelled = false;
    getPasswordStatus(session.token)
      .then((value) => {
        if (!cancelled) setHasPassword(value);
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) await onUnauthorized(session.token);
        else setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
  };

  const needsCurrent = hasPassword === true;

  const validate = (): Errors => {
    const found: Errors = {};
    if (needsCurrent && !current) found.current = "현재 비밀번호를 입력해주세요.";
    if (!next) found.next = "새 비밀번호를 입력해주세요.";
    if (!confirm) found.confirm = "새 비밀번호를 한 번 더 입력해주세요.";
    else if (next !== confirm) found.confirm = "새 비밀번호와 확인이 서로 다릅니다.";
    return found;
  };

  const handleSubmit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setIsSubmitting(true);
    setError("");
    setDone("");
    try {
      const { newToken } = await changePassword(session.token, needsCurrent ? current : null, next);
      // 서버가 새 토큰을 주면(비밀번호 변경 시 기존 토큰이 폐기됨) 저장된 세션을 교체한다.
      if (newToken) {
        const nextSession = { ...session, token: newToken };
        await saveSession(nextSession);
        onSessionChange(nextSession);
      }
      setHasPassword(true);
      reset();
      setOpen(false);
      setDone("비밀번호를 변경했습니다.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await onUnauthorized(session.token);
        return;
      }
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = hasPassword === false ? "비밀번호 설정" : "비밀번호 변경";

  return (
    <Card title="비밀번호">
      {done ? <StatusMessage>{done}</StatusMessage> : null}
      {!open ? (
        <Button
          label={hasPassword === null ? "확인 중" : title}
          variant="secondary"
          busy={hasPassword === null}
          onPress={() => {
            setOpen(true);
            setDone("");
          }}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {needsCurrent ? (
            <TextField
              label="현재 비밀번호"
              autoComplete="current-password"
              onChangeText={setCurrent}
              secureTextEntry
              value={current}
              error={errors.current}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => nextRef.current?.focus()}
            />
          ) : null}
          <TextField
            ref={nextRef}
            label="새 비밀번호"
            autoComplete="new-password"
            onChangeText={setNext}
            secureTextEntry
            value={next}
            error={errors.next}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <TextField
            ref={confirmRef}
            label="새 비밀번호 확인"
            autoComplete="new-password"
            onChangeText={setConfirm}
            secureTextEntry
            value={confirm}
            error={errors.confirm}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {error ? <FormError>{error}</FormError> : null}
          <Button label={title} busy={isSubmitting} busyLabel="처리 중" onPress={handleSubmit} />
          <Button
            label="취소"
            variant="link"
            onPress={() => {
              reset();
              setError("");
              setOpen(false);
            }}
          />
        </View>
      )}
      {!open && error ? <FormError>{error}</FormError> : null}
    </Card>
  );
}
