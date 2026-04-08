-- profiles에 시세 마지막 업데이트 타임스탬프 추가
alter table profiles add column if not exists last_price_update timestamptz;
