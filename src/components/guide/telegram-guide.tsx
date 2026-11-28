import Link from "next/link";
import { LINK_CODE_TTL_MINUTES } from "@/lib/telegram-link";
import { doc } from "@/components/guide/public-site";
import { EmojiLine } from "@/components/ui/info-tip";

// 텔레그램 연결 안내 본문. 화면 이름·버튼 이름·시간·제한은 실제 코드에서 확인한 값이다.
// - 설정 화면: src/components/settings/telegram-link-section.tsx
// - 코드 10분·1회용: src/lib/telegram-link.ts / 발급 10분 10회·시도 10분 10회: src/lib/rate-limit.ts
// - 리포트 전송 버튼: src/app/dashboard/dashboard-client.tsx(기간별 수익률) → src/app/api/portfolio-returns/route.ts
// 스크린샷은 넣지 않는다(화면이 바뀌면 낡는다). 바뀌면 위 파일의 문구와 함께 고친다.

const heading = doc.h2;
const bodyText = doc.p;
const inlineLink = doc.link;

/** 이모지 한 개 + 한 줄 목록 — 문서 본문 글자 크기(16px)에 맞춘다. */
function Lines({ emoji, items }: { emoji: string; items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-base leading-7 text-ink break-keep dark:text-zinc-300">
      {items.map((item) => (
        <EmojiLine key={item} emoji={emoji}>
          {item}
        </EmojiLine>
      ))}
    </ul>
  );
}

const receives = [
  "대시보드 '기간별 수익률'의 '텔레그램 전송' 버튼을 눌렀을 때, 그 계좌의 이름·평가금액·원가·손익·기간별 수익률 리포트",
  "봇에 연결 코드를 보냈을 때 연결 성공 또는 실패 안내",
];

const doesNotReceive = [
  "자동으로 오는 정기 리포트(서비스 운영자 계정용으로 따로 설정된 것)",
  "봇과 자유롭게 주고받는 대화 답변(서비스 운영자가 허용한 채팅에서만 동작합니다)",
  "버튼을 누르지 않은 상태의 알림",
];

const stored = [
  "텔레그램 채팅의 chat_id와 연결 확인 시각(계좌별)",
  "연결 코드는 해시로만 보관하며, 발급 후 10분이 지나면 쓸 수 없습니다",
];

const troubleshooting = [
  {
    q: "봇이 '연결하지 못했습니다'라고 답해요",
    a: `코드가 틀렸거나, 이미 썼거나, ${LINK_CODE_TTL_MINUTES}분이 지났을 수 있습니다. 이유는 구분해서 알려주지 않습니다. 설정의 '텔레그램 연결'에서 '새 코드 발급'을 눌러 새 코드를 받으세요. 새 코드를 받으면 이전 코드는 쓸 수 없습니다. 코드를 받은 뒤 비밀번호를 바꾸면 그 전에 받은 코드도 쓸 수 없습니다.`,
  },
  {
    q: "봇이 아무 답이 없어요",
    a: "같은 채팅에서 코드를 10분 안에 10번 넘게 보내면 봇이 답하지 않습니다. 10분 뒤에 다시 보내 주세요. 봇 이름이 맞는지도 확인해 주세요. 그래도 답이 없으면 서비스 쪽 설정 문제일 수 있으니 운영자에게 문의해 주세요.",
  },
  {
    q: "'연결 코드를 너무 자주 발급했습니다'라고 나와요",
    a: "코드 발급은 10분에 10번까지입니다. 10분 뒤에 다시 시도해 주세요.",
  },
  {
    q: "계좌를 바꿨는데 연결이 안 보여요",
    a: "연결은 계좌마다 따로입니다. '텔레그램 연결' 카드 오른쪽에 지금 선택된 계좌 이름이 표시됩니다. 연결할 계좌를 먼저 고른 뒤 코드를 발급해 주세요. 다른 계좌도 쓰려면 계좌마다 한 번씩 연결해야 합니다.",
  },
  {
    q: "'다시 연결 필요'라고 나와요",
    a: "예전 방식으로 직접 입력한 chat_id는 본인 채팅인지 확인되지 않아 리포트를 보내지 않습니다. 위 순서대로 연결 코드를 보내면 해결됩니다.",
  },
  {
    q: "다른 텔레그램 채팅으로 바꾸고 싶어요",
    a: "'다른 채팅으로 다시 연결'을 눌러 새 코드를 발급하고, 바꿀 채팅에서 봇에 보내세요.",
  },
  {
    q: "'텔레그램 전송' 버튼을 누를 수 없어요",
    a: "선택한 계좌에 연결된 채팅이 없으면 버튼이 비활성화됩니다. 대시보드의 '텔레그램 연결 · 설정' 링크로 설정 화면에 가서 연결해 주세요.",
  },
];

export function TelegramGuide({ botUsername }: { botUsername: string | null }) {
  return (
    <>
      <ul className="mt-6 space-y-2 text-base leading-7 text-ink break-keep dark:text-zinc-300">
        <EmojiLine emoji="🤖">웹 설정에서 받은 연결 코드를 텔레그램 봇에 보내면, 그 채팅이 선택한 계좌에 연결됩니다.</EmojiLine>
        <EmojiLine emoji="💻">연결은 웹에서만 할 수 있고, 모바일 앱에는 이 기능이 없습니다.</EmojiLine>
      </ul>

      <section>
        <h2 className={heading}>연결 방법</h2>
        <ol className={doc.ol}>
          <li>
            <strong className={doc.strong}>텔레그램에서 봇 열기.</strong>{" "}
            {botUsername ? (
              <>
                텔레그램 앱에서{" "}
                <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className={inlineLink}>
                  @{botUsername}
                </a>
                {" "}봇을 열어 주세요.
              </>
            ) : (
              <>
                설정 화면에 표시되는 봇을 텔레그램 앱에서 열어 주세요. 봇 이름은 2단계에서 코드를 발급하면 화면에 나옵니다.
              </>
            )}
          </li>
          <li>
            <strong className={doc.strong}>웹에서 연결 코드 발급.</strong> 로그인한 뒤 설정 화면의 &lsquo;텔레그램 연결&rsquo; 카드에서 연결할 계좌 이름을 확인하고 &lsquo;연결 코드 발급&rsquo;을 누릅니다. 화면에 <code className="bg-zinc-100 px-1 font-mono text-sm dark:bg-zinc-800">/start 코드</code> 형태의 메시지가 나타납니다. 코드는 {LINK_CODE_TTL_MINUTES}분 동안, 한 번만 쓸 수 있습니다.
          </li>
          <li>
            <strong className={doc.strong}>코드를 봇에 보내기.</strong> 화면에 나온 <code className="bg-zinc-100 px-1 font-mono text-sm dark:bg-zinc-800">/start 코드</code>를 그대로 복사해 봇 채팅창에 보냅니다. 화면에 &lsquo;텔레그램에서 열기&rsquo; 버튼이 함께 보이면, 누르면 코드가 채워진 채로 봇이 열립니다.
          </li>
          <li>
            <strong className={doc.strong}>연결 확인.</strong> 봇이 &lsquo;이 채팅을 가족연금계획 계좌에 연결했습니다&rsquo;라고 답하면 성공입니다. 웹에서는 &lsquo;연결 상태 새로고침&rsquo;을 누르면 &lsquo;연결됨&rsquo;과 확인 시각이 표시됩니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className={heading}>연결 해제</h2>
        <ul className="mt-4 space-y-2 text-base leading-7 text-ink break-keep dark:text-zinc-300">
          <EmojiLine emoji="🔌">
            설정의 &lsquo;텔레그램 연결&rsquo; 카드에서 &lsquo;연결 해제&rsquo;를 누르고 확인하면 해당 계좌의 채팅 연결과 아직 쓰지 않은 코드가 지워집니다.
          </EmojiLine>
          <EmojiLine emoji="🗑️">
            이미 전송된 메시지는 서비스에서 삭제할 수 없으니, 필요하면 텔레그램에서 직접 지워 주세요.
          </EmojiLine>
        </ul>
      </section>

      <section>
        <h2 className={heading}>연결하면 받는 것</h2>
        <Lines emoji="✅" items={receives} />
        <h3 className={doc.h3}>받지 않는 것</h3>
        <Lines emoji="🚫" items={doesNotReceive} />
      </section>

      <section>
        <h2 className={heading}>저장되는 정보</h2>
        <Lines emoji="🗂️" items={stored} />
        <p className={bodyText}>
          자세한 처리 기준은{" "}
          <Link href="/privacy" className={inlineLink}>
            개인정보처리방침
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </section>

      <section>
        <h2 className={heading}>자주 막히는 경우</h2>
        <div className="mt-4 divide-y divide-hairline border-y border-hairline dark:divide-zinc-800 dark:border-zinc-800">
          {troubleshooting.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <span className={doc.strong}>{item.q}</span>
                <svg aria-hidden="true" className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="pb-4 text-base leading-7 text-ink break-keep dark:text-zinc-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
