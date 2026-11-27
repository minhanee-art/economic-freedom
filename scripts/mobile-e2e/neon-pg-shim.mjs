// 테스트 전용: Neon HTTP 드라이버(@neondatabase/serverless 의 neon())가 보내는 fetch 를 가로채
// 로컬 Postgres(pg)로 실행한다. 앱 코드(src/lib/db.ts)는 그대로 두고, `node --import` 로만 주입한다.
//
//   NEON_SHIM_PG_URL=postgres://...@127.0.0.1:PORT/db \
//   DATABASE_URL=postgres://shim:shim@neon-shim.localhost/db \
//   NODE_OPTIONS="--import /abs/path/neon-pg-shim.mjs" next dev
//
// neon() 은 연결 문자열의 호스트 첫 레이블을 api. 로 바꿔 https://api.neon-shim.localhost/sql 로 POST 한다.
// 요청 본문: { query, params } 또는 { queries: [{ query, params }, ...] }(transaction).
// 응답: { fields: [{ name, dataTypeID }], rows: [[text...]], command, rowCount } (Raw-Text + Array-Mode).
// 오류는 HTTP 400 + { message, code, ... } — 드라이버가 NeonDbError 로 바꾼다.
import pg from "pg";

const HOST_MARK = process.env.NEON_SHIM_HOST ?? "neon-shim.localhost";
const PG_URL = process.env.NEON_SHIM_PG_URL;

if (PG_URL) {
  const pool = new pg.Pool({ connectionString: PG_URL, max: 8 });
  // 모든 값을 Postgres 텍스트 그대로 돌려준다 — 형 변환은 드라이버가 dataTypeID 로 한다.
  const rawTypes = { getTypeParser: () => (value) => value };
  const ERROR_FIELDS = ["severity", "code", "detail", "hint", "position", "internalPosition", "internalQuery", "where", "schema", "table", "column", "dataType", "constraint", "file", "line", "routine"];

  const run = async (client, q) => {
    const result = await client.query({ text: q.query, values: q.params ?? [], rowMode: "array", types: rawTypes });
    return {
      fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      rows: result.rows,
      command: result.command,
      rowCount: result.rowCount,
    };
  };

  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function neonShimFetch(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";
    if (process.env.NEON_SHIM_DEBUG) console.error(`[neon-pg-shim] fetch ${url}`);
    if (!url.includes(HOST_MARK)) return originalFetch(input, init);

    const payload = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const client = await pool.connect();
    try {
      if (Array.isArray(payload.queries)) {
        await client.query("BEGIN");
        try {
          const results = [];
          for (const q of payload.queries) results.push(await run(client, q));
          await client.query("COMMIT");
          return json(200, { results });
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        }
      }
      return json(200, await run(client, payload));
    } catch (error) {
      const body = { message: error?.message ?? String(error) };
      for (const key of ERROR_FIELDS) if (error?.[key] !== undefined) body[key] = error[key];
      return json(400, body);
    } finally {
      client.release();
    }
  };
  if (process.env.NEON_SHIM_DEBUG) console.error(`[neon-pg-shim] pid ${process.pid}: ${HOST_MARK} → local Postgres`);
}
