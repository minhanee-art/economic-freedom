import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { changePassword, getPasswordStatus } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Card } from "@/components/Card";
import { clearSession, saveSession } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors } from "@/styles/theme";
import type { AuthSession } from "@/types";

/** 설정 탭의 비밀번호 변경(Google 전용 계정이면 설정) 카드. */
export function PasswordCard({ session, onSessionChange }: { session: AuthSession; onSessionChange: (next: AuthSession) => void }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const handleUnauthorized = async () => {
    await clearSession();
    router.replace("/login");
  };

  useEffect(() => {
    let cancelled = false;
    getPasswordStatus(session.token)
      .then((value) => {
        if (!cancelled) setHasPassword(value);
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) await handleUnauthorized();
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
  };

  const mismatch = confirm.length > 0 && next !== confirm;
  const needsCurrent = hasPassword === true;
  const disabled = isSubmitting || hasPassword === null || !next || next !== confirm || (needsCurrent && !current);

  const handleSubmit = async () => {
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
        await handleUnauthorized();
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
      {done ? <Text style={[styles.label, { color: colors.positive }]}>{done}</Text> : null}
      {!open ? (
        <Pressable
          disabled={hasPassword === null}
          onPress={() => {
            setOpen(true);
            setDone("");
          }}
          style={[styles.button, { marginTop: 0 }, hasPassword === null && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{hasPassword === null ? "확인 중" : title}</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 12 }}>
          {needsCurrent ? (
            <View style={styles.field}>
              <Text style={styles.label}>현재 비밀번호</Text>
              <TextInput
                autoComplete="current-password"
                onChangeText={setCurrent}
                secureTextEntry
                style={styles.input}
                value={current}
              />
            </View>
          ) : null}
          <View style={styles.field}>
            <Text style={styles.label}>새 비밀번호</Text>
            <TextInput autoComplete="new-password" onChangeText={setNext} secureTextEntry style={styles.input} value={next} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>새 비밀번호 확인</Text>
            <TextInput autoComplete="new-password" onChangeText={setConfirm} secureTextEntry style={styles.input} value={confirm} />
          </View>
          {mismatch ? <Text style={styles.error}>새 비밀번호가 서로 다릅니다.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable disabled={disabled} onPress={handleSubmit} style={[styles.button, { marginTop: 0 }, disabled && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>{isSubmitting ? "처리 중" : title}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              reset();
              setError("");
              setOpen(false);
            }}
          >
            <Text style={styles.linkText}>취소</Text>
          </Pressable>
        </View>
      )}
      {!open && error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}
