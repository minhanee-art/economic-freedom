// JWT 세션 관리 — jose 기반. 웹은 HTTP-only 쿠키, 모바일 앱은 Authorization: Bearer 헤더로 같은 토큰을 쓴다.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = "pension-session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30일

export type SessionSource = "cookie" | "bearer";
export type RequestSession = { userId: string; source: SessionSource };

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    // iat — 이후 "이 시각 이전 발급 토큰 무효화" 방식의 폐기를 붙일 수 있게 남겨 둔다.
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    // 알고리즘 고정 — 헤더의 alg를 신뢰하지 않는다.
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/** 서버 컴포넌트(페이지)에서 쿠키로 userId 가져오기. Route Handler는 getRequestSession을 쓴다. */
export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await verifyToken(token);
  return userId ? { userId } : null;
}

/** 요청의 Cookie 헤더에서 세션 토큰 값을 꺼낸다. */
function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== COOKIE_NAME) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return raw || null;
    }
  }
  return null;
}

/** Authorization: Bearer <token> 헤더에서 토큰을 꺼낸다. */
function readBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const [scheme, token, ...rest] = auth.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) return null;
  return token;
}

/** 모바일 앱/API 클라이언트용 Bearer 토큰 세션 */
export async function getBearerSession(request: Request): Promise<{ userId: string } | null> {
  const token = readBearerToken(request);
  if (!token) return null;
  const userId = await verifyToken(token);
  return userId ? { userId } : null;
}

/**
 * Route Handler·Proxy 공통 인증 — 유효한 세션 쿠키가 있으면 그것을 쓰고,
 * 없거나 무효하면 Authorization: Bearer 토큰을 본다.
 * 같은 JWT를 쓰므로 웹과 모바일이 같은 사용자 API를 호출할 수 있다.
 */
export async function getRequestSession(request: Request): Promise<RequestSession | null> {
  const cookieToken = readSessionCookie(request);
  if (cookieToken) {
    const userId = await verifyToken(cookieToken);
    if (userId) return { userId, source: "cookie" };
  }
  const bearer = await getBearerSession(request);
  return bearer ? { userId: bearer.userId, source: "bearer" } : null;
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
