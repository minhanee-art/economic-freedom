import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";
import { deleteAccount, getPasswordStatus } from "@/api/auth";
import { ApiError, webUrl } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { clearSession, handleUnauthorized, loadSession } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors } from "@/styles/theme";

export default function DeleteAccountScreen() {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  // null: 확인 중. false면 Google 전용 계정이라 비밀번호 대신 이메일로 확인한다.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
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
    Alert.alert(
      "정말 계정을 삭제할까요?",
      "계정과 모든 포트폴리오 데이터가 영구 삭제되며 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "계정 삭제", style: "destructive", onPress: performDelete },
      ]
    );
  };

  const disabled = isSubmitting || hasPassword === null || (hasPassword ? !password : !email.trim());

  return (
    <AppShell>
      <Text style={styles.title}>계정 삭제</Text>
      <Text style={styles.subtitle}>계정을 삭제하면 저장된 모든 데이터가 영구적으로 사라지며 복구할 수 없습니다.</Text>

      <Card title={hasPassword === false ? "이메일 확인" : "비밀번호 확인"}>
        {hasPassword === false ? (
          <View style={styles.field}>
            <Text style={styles.label}>계정 이메일</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="가입한 이메일 주소"
              placeholderTextColor={colors.inkSubtle}
              style={styles.input}
              value={email}
            />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              autoComplete="current-password"
              editable={hasPassword !== null}
              onChangeText={setPassword}
              placeholder="현재 비밀번호"
              placeholderTextColor={colors.inkSubtle}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={disabled}
          onPress={confirmDelete}
          style={[styles.button, styles.dangerButton, disabled && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "삭제 중" : "계정 영구 삭제"}</Text>
        </Pressable>
      </Card>

      {guideUrl ? (
        <Pressable style={styles.linkButton} onPress={() => Linking.openURL(guideUrl)}>
          <Text style={styles.linkText}>계정 삭제 안내 보기</Text>
        </Pressable>
      ) : null}
    </AppShell>
  );
}
