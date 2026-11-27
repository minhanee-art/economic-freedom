import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { loginWithEmail } from "@/api/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { saveSession } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors } from "@/styles/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const session = await loginWithEmail(email.trim(), password);
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
      <Text style={styles.title}>가족연금계획</Text>
      <Text style={styles.subtitle}>로그인하면 내 포트폴리오와 배당 현금흐름을 확인할 수 있습니다.</Text>

      <Card title="로그인">
        <View style={styles.field}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
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
            autoComplete="current-password"
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
        <Text style={styles.subtitle}>
          Google로 가입했다면 웹에서 Google로 로그인한 뒤 설정에서 비밀번호를 만들면 앱에서 로그인할 수 있습니다.
        </Text>
      </Card>

      <Link href="/signup" asChild>
        <Pressable style={styles.linkButton}>
          <Text style={styles.linkText}>계정이 없으신가요? 회원가입</Text>
        </Pressable>
      </Link>
    </AppShell>
  );
}
