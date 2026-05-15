// Neon 서버리스 PostgreSQL 클라이언트
import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);
