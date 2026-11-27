import { Link, router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { signupWithEmail } from "@/api/auth";
import { webUrl } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { saveSession } from "@/storage/session";
import { formStyles as styles } from "@/styles/forms";
import { colors } from "@/styles/theme";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const disabled = isSubmitting || !email.trim() || !password || password !== passwordConfirm;
  const privacyUrl = webUrl("/privacy");

  const handleSignup = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const session = await signupWithEmail(email.trim(), password);
      await saveSession(session);
      router.replace("/(tabs)");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <Text style={styles.title}>회원가입</Text>
      <Text style={styles.subtitle}>이메일과 비밀번호로 계정을 만듭니다. 웹에서 만든 계정과 같은 계정입니다.</Text>

      <Card title="계정 만들기">
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
            autoComplete="new-password"
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor={colors.inkSubtle}
            secureTextEntry
            style={styles.input}
            value={password}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            autoComplete="new-password"
            onChangeText={setPasswordConfirm}
            placeholder="비밀번호를 한 번 더 입력"
            placeholderTextColor={colors.inkSubtle}
            secureTextEntry
            style={styles.input}
            value={passwordConfirm}
          />
        </View>
        {mismatch ? <Text style={styles.error}>비밀번호가 서로 다릅니다.</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={disabled} onPress={handleSignup} style={[styles.button, disabled && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{isSubmitting ? "가입 중" : "회원가입"}</Text>
        </Pressable>
      </Card>

      {privacyUrl ? (
        <Text style={styles.helper}>
          가입하면 <Text onPress={() => Linking.openURL(privacyUrl)} style={styles.linkText}>개인정보처리방침</Text>에 동의한 것으로 봅니다.
        </Text>
      ) : null}

      <Link href="/login" asChild>
        <Pressable style={styles.linkButton}>
          <Text style={styles.linkText}>이미 계정이 있으신가요? 로그인</Text>
        </Pressable>
      </Link>
    </AppShell>
  );
}
