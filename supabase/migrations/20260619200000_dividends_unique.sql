-- dividends 테이블에 (holding_id, date) 복합 유니크 제약 추가
-- 자동조회 upsert를 위해 필요

-- 중복 데이터가 있을 경우 먼저 정리 (가장 최근 created_at만 남김)
DELETE FROM dividends d1
WHERE EXISTS (
  SELECT 1 FROM dividends d2
  WHERE d2.holding_id = d1.holding_id
    AND d2.date = d1.date
    AND d2.created_at > d1.created_at
);

ALTER TABLE dividends
  ADD CONSTRAINT dividends_holding_date_unique UNIQUE (holding_id, date);
