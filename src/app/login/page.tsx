import { AuthForm } from "@/components/ui/auth-form";
import { loginErrorMessage } from "@/lib/login-errors";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  return <AuthForm mode="login" initialError={loginErrorMessage(error) ?? undefined} />;
}
