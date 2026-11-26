// JWT 세션 관리 — jose 기반. 웹은 HTTP-only 쿠키, 모바일 앱은 Authorization: Bearer 헤더로 같은 토큰을 쓴다.
// 토큰에는 users.session_version을 sv 클레임으로 넣고, 검증 때 DB 값과 대조해 폐기된 토큰을 거부한다.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getSessionVersion } from "@/lib/session-version";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = "pension-session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30일

export type SessionSource = "cookie" | "bearer";
export type RequestSession = { userId: string; source: SessionSource };
export type TokenClaims = { userId: string; sessionVersion: number };

export async function signToken(userId: string, sessionVersion: number): Promise<string> {
  if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0) {
    throw new Error("세션 버전이 올바르지 않습니다.");
  }
  return new SignJWT({ sub: userId, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

/**
 * 서명·만료만 확인한다(DB 조회 없음). 폐기 여부는 모른다 — Proxy의 낙관적 검사 전용.
 * sv 클레임이 없는 토큰은 이 기능 배포 전에 발급된 것이므로 버전 0으로 본다.
 */
export async function decodeToken(token: string): Promise<TokenClaims | null> {
  try {
    // 알고리즘 고정 — 헤더의 alg를 신뢰하지 않는다.
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    // 클레임이 "없을" 때만 0 — null 등 다른 값은 형식 오류로 거부한다
    const sv = payload.sv === undefined ? 0 : payload.sv;
    if (typeof sv !== "number" || !Number.isSafeInteger(sv) || sv < 0) return null;
    return { userId: payload.sub, sessionVersion: sv };
  } catch {
    return null;
  }
}

/**
 * 서명·만료 + 폐기 여부까지 확인한다. 사용자가 없거나(삭제) 세션 버전이 다르면(비밀번호 변경 등) null.
 * 요청당 users PK 조회 1회가 추가된다.
 */
export async function verifyToken(token: string): Promise<string | null> {
  const claims = await decodeToken(token);
  if (!claims) return null;
  const current = await getSessionVersion(claims.userId);
  return current !== null && current === claims.sessionVersion ? claims.userId : null;
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
 * Proxy 전용 낙관적 검사 — 쿠키 또는 Bearer 토큰의 서명·만료만 본다.
 * 페이지 Proxy는 prefetch마다 실행되므로 DB를 조회하지 않고, 실제 판정은 페이지의 getSession이 한다.
 */
export async function getOptimisticRequestSession(request: Request): Promise<RequestSession | null> {
  const cookieToken = readSessionCookie(request);
  if (cookieToken) {
    const claims = await decodeToken(cookieToken);
    if (claims) return { userId: claims.userId, source: "cookie" };
  }
  const bearerToken = readBearerToken(request);
  const claims = bearerToken ? await decodeToken(bearerToken) : null;
  return claims ? { userId: claims.userId, source: "bearer" } : null;
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
