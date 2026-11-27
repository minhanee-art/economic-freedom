import test, { before, mock } from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { createFakeSql } from "@/test/api-helpers";

process.env.CRON_SECRET ||= "cron-test-secret";
process.env.REPORT_USER_ID ||= "cron-user-1";

const db = createFakeSql();
const telegramCalls: number[] = [];

mock.module("@/lib/db", { namedExports: { sql: db.sql } });
mock.module("@/lib/telegram", {
  namedExports: {
    sendTelegramMessage: async () => {
      telegramCalls.push(1);
      return true;
    },
  },
});
mock.module("@/lib/kis", {
  namedExports: {
    getKisToken: async () => "kis-token",
    getKisPrice: async () => ({ price: 10_000, change: 0, changePct: 0 }),
  },
});
mock.module("@/lib/yahoo", {
  namedExports: {
    getYahooPrice: async () => ({ price: 100, change: 0, changePct: 0 }),
  },
});

type CronRoute = {
  name: string;
  GET: (request: Request) => Promise<Response>;
};

const routes: CronRoute[] = [];

before(async () => {
  const names = [
    "dividend-calendar",
    "dividend-news",
    "market-close",
    "portfolio",
    "report",
    "sentiment",
    "technical",
  ];
  for (const name of names) {
    const routeModule = (await import(`@/app/api/cron/${name}/route`)) as { GET: CronRoute["GET"] };
    routes.push({ name, GET: routeModule.GET });
  }
});

function cronRequest(path: string, headers: Record<string, string> = {}): Request {
  // cron 라우트는 request.nextUrl.searchParams를 쓰므로 NextRequest가 필요하다
  return new NextRequest(new URL(path, "https://pension.test"), { headers });
}

test("시크릿이 없으면 모든 cron 라우트가 401", async (t) => {
  assert.equal(routes.length, 7);
  for (const route of routes) {
    await t.test(route.name, async () => {
      const response = await route.GET(cronRequest(`/api/cron/${route.name}`));
      assert.equal(response.status, 401);
    });
  }
});

test("시크릿이 틀리면 401", async (t) => {
  for (const route of routes) {
    await t.test(route.name, async () => {
      const response = await route.GET(
        cronRequest(`/api/cron/${route.name}`, { authorization: "Bearer wrong-secret" })
      );
      assert.equal(response.status, 401);
    });
  }
});

test("Bearer 시크릿이 맞으면 인증을 통과한다", async (t) => {
  for (const route of routes) {
    await t.test(route.name, async () => {
      const response = await route.GET(
        cronRequest(`/api/cron/${route.name}`, {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        })
      );
      assert.notEqual(response.status, 401, `${route.name}가 401을 돌려줌`);
      assert.notEqual(response.status, 500, `${route.name}가 500으로 실패`);
    });
  }
});

test("쿼리 시크릿(?secret=)은 더 이상 인증으로 인정하지 않는다", async (t) => {
  for (const route of routes) {
    await t.test(route.name, async () => {
      const response = await route.GET(
        cronRequest(`/api/cron/${route.name}?secret=${process.env.CRON_SECRET}&type=all`)
      );
      assert.equal(response.status, 401);
    });
  }
  assert.equal(telegramCalls.length > 0, true, "앞선 Bearer 테스트에서는 전송이 있었어야 한다");
});

test("Bearer 접두어가 없거나 시크릿 앞뒤가 다르면 401", async (t) => {
  const secret = process.env.CRON_SECRET!;
  const report = routes.find((route) => route.name === "report")!;
  for (const authorization of [secret, `bearer ${secret}`, `Bearer ${secret}x`, `Bearer ${secret.slice(1)}`, `Bearer  ${secret}`]) {
    await t.test(JSON.stringify(authorization), async () => {
      const response = await report.GET(cronRequest("/api/cron/report?type=all", { authorization }));
      assert.equal(response.status, 401);
    });
  }
});

test("CRON_SECRET이 공백뿐이면 'Bearer ' 헤더도 거부한다(fail closed)", async () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "   ";
  try {
    const report = routes.find((route) => route.name === "report")!;
    for (const authorization of ["Bearer    ", "Bearer ", "Bearer"]) {
      const response = await report.GET(cronRequest("/api/cron/report", { authorization }));
      assert.equal(response.status, 401);
    }
  } finally {
    process.env.CRON_SECRET = saved;
  }
});
