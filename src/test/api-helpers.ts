// API 라우트 테스트용 스텁 — node:test의 module mock과 함께 쓴다.
export type SqlHandler = (query: string, values: unknown[]) => unknown;

export type SqlCall = { query: string; values: unknown[] };

type FakeSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  transaction: (queries: unknown[]) => Promise<unknown>;
};

export function createFakeSql(initialHandler: SqlHandler = () => []) {
  const calls: SqlCall[] = [];
  let handler = initialHandler;

  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ query, values });
    return Promise.resolve().then(() => handler(query, values));
  }) as FakeSql;

  sql.transaction = async (queries: unknown[]) => {
    calls.push({ query: "<transaction>", values: queries });
    return queries;
  };

  return {
    sql,
    calls,
    setHandler(next: SqlHandler) {
      handler = next;
    },
    reset() {
      calls.length = 0;
      handler = initialHandler;
    },
    /** 특정 SQL만 골라 호출 값을 돌려준다 */
    find(fragment: string) {
      return calls.filter((call) => call.query.includes(fragment));
    },
  };
}

export function createSessionState(userId: string | null = "user-1") {
  const state = { userId };
  return {
    state,
    namedExports: {
      getSession: async () => (state.userId ? { userId: state.userId } : null),
      getBearerSession: async () => (state.userId ? { userId: state.userId } : null),
      getRequestSession: async () => (state.userId ? { userId: state.userId, source: "cookie" as const } : null),
    },
  };
}

export type FakeAccount = { id: string; name: string; ownerType: string };

export function createAccountsState(
  accounts: FakeAccount[] = [{ id: "acc-1", name: "기본 계좌", ownerType: "self" }],
  activeAccountId = "acc-1"
) {
  const state = {
    accounts,
    activeAccountId,
    created: [] as FakeAccount[],
    failCreate: null as Error | null,
  };

  return {
    state,
    namedExports: {
      ACCOUNT_COOKIE: "pension-account",
      ACCOUNT_MAX_AGE: 60,
      getActivePortfolioAccountId: async () => state.activeAccountId,
      getPortfolioAccounts: async () => state.accounts,
      createPortfolioAccount: async (_userId: string, name: string, ownerType: string) => {
        if (state.failCreate) throw state.failCreate;
        const account = { id: `acc-${state.created.length + 2}`, name, ownerType };
        state.created.push(account);
        return account;
      },
    },
  };
}

export function jsonRequest(method: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request("https://pension.test/api/route", init);
}

export function rawRequest(method: string, body: string): Request {
  return new Request("https://pension.test/api/route", {
    method,
    headers: { "content-type": "application/json" },
    body,
  });
}

export async function readJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export type AuthOptions = {
  body?: unknown;
  /** 세션 쿠키 토큰 (pension-session) */
  cookie?: string;
  /** Authorization: Bearer 토큰 */
  bearer?: string;
  url?: string;
};

/** 쿠키 또는 Bearer 인증 헤더를 붙인 요청 */
export function authRequest(method: string, options: AuthOptions = {}): Request {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = `pension-session=${options.cookie}`;
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;
  const init: RequestInit = { method, headers };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  return new Request(options.url ?? "https://pension.test/api/route", init);
}
