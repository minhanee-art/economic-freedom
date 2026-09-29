import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { loginWithEmail } from "@/api/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { saveSession } from "@/storage/session";
import { colors, radius, spacing } from "@/styles/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const session = await loginWithEmail(email, password);
      await saveSession(session);
      router.replace("/(tabs)");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabled = isSubmitting || !email.trim() || !password;

  return (
    <AppShell>
      <Text style={styles.title}>계정 연결</Text>
      <Text style={styles.subtitle}>기존 웹 계정으로 로그인하면 실제 포트폴리오 데이터를 불러옵니다.</Text>

      <Card title="로그인">
        <View style={styles.field}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={colors.inkSubtle}
            style={styles.input}
            value={email}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor={colors.inkSubtle}
            secureTextEntry
            style={styles.input}
            value={password}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={disabled} onPress={handleLogin} style={[styles.button, disabled && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{isSubmitting ? "로그인 중" : "로그인"}</Text>
        </Pressable>
      </Card>

      <Text style={styles.helper}>API 주소는 `EXPO_PUBLIC_API_BASE_URL` 환경변수로 설정합니다.</Text>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    marginBottom: spacing.lg,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  error: {
    borderRadius: radius.md,
    backgroundColor: colors.negativeSoft,
    color: colors.negative,
    padding: spacing.md,
    fontSize: 13,
    fontWeight: "800",
  },
  button: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    padding: spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: colors.inkSubtle,
  },
  buttonText: {
    color: colors.surface,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
  },
  helper: {
    marginTop: spacing.lg,
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
