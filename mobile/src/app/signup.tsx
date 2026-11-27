import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Text, type TextInput } from "react-native";
import { signupWithEmail } from "@/api/auth";
import { webUrl } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/Field";
import { FormError } from "@/components/Parts";
import { saveSession } from "@/storage/session";
import { colors, type } from "@/styles/theme";

type Errors = { email?: string; password?: string; passwordConfirm?: string };

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const privacyUrl = webUrl("/privacy");

  // 확인 칸을 채운 뒤에는 누르기 전에도 불일치 이유를 칸 아래에 바로 보인다.
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm ? "비밀번호와 확인이 서로 다릅니다." : undefined;

  const handleSignup = async () => {
    const found: Errors = {};
    if (!email.trim()) found.email = "이메일을 입력해주세요.";
    if (!password) found.password = "비밀번호를 입력해주세요.";
    if (!passwordConfirm) found.passwordConfirm = "비밀번호를 한 번 더 입력해주세요.";
    else if (mismatch) found.passwordConfirm = mismatch;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
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
      <Text style={type.label}>이메일과 비밀번호로 계정을 만듭니다. 웹에서 만든 계정과 같은 계정이라 웹과 앱에서 같은 이메일로 로그인합니다.</Text>

      <Card>
        <TextField
          label="이메일"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@example.com"
          value={email}
          error={errors.email}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="비밀번호"
          autoComplete="new-password"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
          error={errors.password}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <TextField
          ref={confirmRef}
          label="비밀번호 확인"
          autoComplete="new-password"
          onChangeText={setPasswordConfirm}
          secureTextEntry
          value={passwordConfirm}
          error={errors.passwordConfirm ?? mismatch}
          returnKeyType="go"
          onSubmitEditing={handleSignup}
        />
        {error ? <FormError>{error}</FormError> : null}
        <Button label="회원가입" busy={isSubmitting} busyLabel="가입 중" onPress={handleSignup} />
        {privacyUrl ? (
          <Text style={type.caption}>
            가입하면{" "}
            <Text accessibilityRole="link" onPress={() => Linking.openURL(privacyUrl)} style={{ color: colors.primary, textDecorationLine: "underline" }}>
              개인정보처리방침
            </Text>
            에 동의한 것으로 봅니다.
          </Text>
        ) : null}
      </Card>

      <Link href="/login" asChild>
        <Button label="이미 계정이 있으신가요? 로그인" variant="link" />
      </Link>
    </AppShell>
  );
}
