import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { type TextInput } from "react-native";
import { Text } from "@/components/AppText";
import { loginWithEmail } from "@/api/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/Field";
import { EmojiLine, InfoTip } from "@/components/InfoTip";
import { FormError, ScreenTitle } from "@/components/Parts";
import { saveSession } from "@/storage/session";
import { type } from "@/styles/theme";

type Errors = { email?: string; password?: string };

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    const found: Errors = {};
    if (!email.trim()) found.email = "이메일을 입력해주세요.";
    if (!password) found.password = "비밀번호를 입력해주세요.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // 빈 제출 뒤에는 첫 오류 칸으로 초점을 옮긴다(스크린리더가 그 칸의 이름과 오류를 읽는다).
      (found.email ? emailRef : passwordRef).current?.focus();
      return;
    }
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

  return (
    <AppShell>
      <ScreenTitle>가족연금계획</ScreenTitle>
      <EmojiLine emoji="🏦" size="sm">로그인하면 내 포트폴리오와 배당 현금흐름을 봅니다.</EmojiLine>

      <Card>
        <TextField
          ref={emailRef}
          label="이메일"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
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
          autoComplete="current-password"
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          revealable
          value={password}
          error={errors.password}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
        {error ? <FormError>{error}</FormError> : null}
        <Button label="로그인" busy={isSubmitting} busyLabel="로그인 중" onPress={handleLogin} />
        <EmojiLine
          emoji="🔑"
          size="sm"
          trailing={
            <InfoTip label="Google 가입 계정 로그인 안내" side="top">
              웹에서 Google로 로그인한 뒤 설정에서 비밀번호를 만들면, 그 이메일과 비밀번호로 앱에 로그인할 수 있습니다.
            </InfoTip>
          }
        >
          Google로 가입했다면 웹에서 비밀번호를 먼저 만드세요.
        </EmojiLine>
      </Card>

      <Link href="/signup" asChild>
        <Button label="계정이 없으신가요? 회원가입" variant="link" />
      </Link>
    </AppShell>
  );
}
