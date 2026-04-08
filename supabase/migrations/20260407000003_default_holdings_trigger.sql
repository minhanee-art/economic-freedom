-- ============================================
-- 신규 사용자 가입 시 기본 종목 15개 자동 생성
-- ============================================

create or replace function create_default_holdings()
returns trigger as $$
begin
  -- 프로필 생성
  insert into profiles (id, email)
  values (new.id, new.email);

  -- 기본 종목 15개 삽입
  insert into holdings (user_id, code, name, category, sub_category, current_price, target_pct) values
    (new.id, '305050', 'ACE 코스피',              '주식',   '국장',   57490, 13.0),
    (new.id, '354500', 'ACE 코스닥150',            '주식',   '국장',   17830, 10.0),
    (new.id, '161510', 'PLUS 고배당주',            '주식',   '배당',   25120, 10.0),
    (new.id, '458730', 'TIGER 미국배당다우존스',    '주식',   '배당',   14635, 10.0),
    (new.id, '453810', 'KODEX 인도Nifty50',        '주식',   '인도',   12560,  5.0),
    (new.id, '497570', 'TIGER 필라델피아반도체',    '주식',   '신기술', 17040,  5.0),
    (new.id, '316300', 'ACE 싱가포르리츠',         '리츠',   '리츠',   14245,  5.0),
    (new.id, '319640', 'TIGER 골드선물(H)',        '원자재', '금',     27810,  7.0),
    (new.id, '261220', 'KODEX WTI원유선물(H)',     '원자재', '원유',   27850,  5.0),
    (new.id, '305080', 'TIGER 미국채10년선물',     '채권',   '채권',   13580,  5.0),
    (new.id, '237350', 'KODEX 코스피100',          '주식',   '국장',   65500,  0.0),
    (new.id, '457480', 'ACE 테슬라밸류체인',       '주식',   '테슬라', 20305,  0.0),
    (new.id, '182480', 'TIGER 미국MSCI리츠',       '리츠',   '리츠',   12890,  0.0),
    (new.id, '144600', 'KODEX 은선물(H)',          '원자재', '은',     11960,  0.0),
    (new.id, '153130', 'KODEX 단기채권',           '채권',   '채권',  113390,  0.0);

  return new;
end;
$$ language plpgsql security definer;

-- auth.users에 새 사용자가 생성될 때 트리거 실행
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_default_holdings();
