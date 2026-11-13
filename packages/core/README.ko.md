# @monti-cms/core

[English](README.md) | 한국어

Monti가 하는 일은 모두 **기능**이다. 기능 하나를 정의하면 관리자 API 라우트, 에이전트 도구, CLI 명령이 같은 입력 검사, 버전 확인, 활동 기록과
함께 생긴다. 그래서 어느 입구도 다른 입구의 규칙을 비켜 가지 못한다. 설계는
[`docs/design/features/00-foundation.md`](../../docs/design/features/00-foundation.md)에 있다.

```ts
import { defineOperation } from "@monti-cms/core";
import { z } from "zod";

export const moveToFolder = defineOperation({
	name: "entries.moveToFolder",
	kind: "write",
	description: "Move entries into a folder.", // for the model
	input: z.object({ ids: z.array(z.string()).min(1), folderId: z.string() }),
	touches: (input) => input.ids.map((id) => ({ kind: "entry", id })), // versioned and snapshotted for undo
	check: async (input, ctx) => {/* throw CheckError to refuse */},
	run: async (input, ctx) => {/* write through ctx.db; ctx.emit(event) for receivers */},
	summary: (input) => ({ key: "entries.moveToFolder", values: { count: input.ids.length } }), // 활동 기록 줄의 첫 줄
	log: "save", // 활동 기록이 거르는 종류
});
```

## 쓰기가 도는 길

`createMonti({ db, operations, recordKinds, receivers, plugins })`는 모든 쓰기를 같은 길로, 한 트랜잭션 안에서 돌린다.

1. 입력을 스키마로 검사한다.
2. `touches`의 레코드를 읽는다. 부른 쪽이 읽은 버전이 지금 버전과 다르면 충돌이다(`ConflictError`).
3. `check`, 그다음 `run`.
4. 활동 기록 한 줄과, 건드리고 만든 레코드의 스냅숏을 남긴다. 그래서 30일 동안 되돌릴 수 있다(`activity.undo`). 되돌리기는 그 사이 고쳐진
   레코드를 건너뛰고 덮어쓰지 않는다.
5. 쓰기가 낸 이벤트는 받는 곳마다 줄에 넣고, 커밋된 뒤에만 보낸다.

받는 곳은 웹훅(`receivers: [webhook("https://example.dev/api/revalidate")]`)이거나 플러그인의 것이다. 웹훅에는 이름이 있고(`webhook(url, { name })`.
없으면 주소의 호스트만) 전송은 그 이름으로 저장되고 보인다. 주소 자체와 경로나 쿼리에 든 토큰은 저장하지 않는다. 한 사이트의 받는 곳 둘이 같은
이름일 수 없다: 한 호스트의 웹훅 둘은 저마다 `name`이 있어야 한다. 리다이렉트는 따라가지 않고 실패다. 풀리지 않는 주소와 사용자 · 비밀번호가 든 주소(`https://user:pass@…`)는 사이트를 열 때
거절한다: 계정은 `headers`(`Authorization`)로 보내거나 `secret`으로 서명한다. 전송이 실패한 까닭은 네 가지 가운데 하나로 남고, 오류의 글(주소를
옮길 수 있다)은 남기지 않는다: 받는 곳의 상태, 답 없음(네트워크의 코드와 함께), 받는 곳 없음, 보내지 못함. 실패했거나 10초 넘게 걸린 전송은 바로
활동 기록과 사이드바 개수에 실패로 보인다. 그 뒤 사이를 늘려 가며 8번까지 저절로 다시 보내고(`RETRY_MINUTES`, 관리자 화면에 들어올 때와
`monti deliveries:run`), 그래도 안 되면 사람이 다시 보내거나(`deliveries.retry`, 한 번에 한 묶음씩) 취소할(`deliveries.cancel`) 때까지 실패로
남는다. 아무도 기다리지 않는 전송은 호스트의 `waitUntil`에 맡긴다(`openMonti(config, root, { waitUntil })`. `@monti-cms/next`는 Next의
`after`를 넘긴다). 서버리스 함수가 보내는 도중에 끝나지 않게 하려는 것이다. 호스트는 돌고 있는 일이 아니라 시작할 일을 받는다:
`waitUntil: (work) => context.waitUntil(work())`. 이런 호스트에서 쓰기는 웹훅을 기다리지 않고 답한다.
`beforeAnswer: true`인 받는 곳은 그래도 답하기 전에 보낸다(사이트의 캐시된 페이지가 그렇다. 발행이 답했으면 사이트에 나와 있다). 그 기다림은
쓰기 하나에 마감 하나다(10초. 남은 것은 답한 뒤에 보낸다). `oncePerWrite: true`인 받는 곳은 무슨 이벤트든 하는 일이 같아서, 쓰기가 이벤트를
몇 개 내든 한 번만 받는다.

**이벤트는 두 번 올 수 있다.** 받는 곳이 이벤트를 처리했는데 답이 돌아오다 끊기면, Monti는 실패로 세고 다시 보낸다. 다시 보낼 때마다 같은 id가
가므로, 두 번 하면 안 되는 받는 곳은 처리한 id를 적어 둔다.

| 어디 | 무엇 |
|---|---|
| 본문의 `id`, 헤더 `Monti-Event-Id` | 이벤트의 id. 다시 보낼 때마다 같고, 그 이벤트를 받는 곳 모두에게 같다 |
| 헤더 `Monti-Delivery-Id` | 이 받는 곳으로 가는 전송의 id. 다시 보낼 때마다 같다 |
| 헤더 `Monti-Attempt` | 몇 번째 시도인지, 1부터 |
| 헤더 `Monti-Signature` | `webhook(url, { secret })`일 때만: `t=<초>,v1=<hex>`. `v1`은 `<t>.<본문>`을 그 웹훅의 비밀값으로 HMAC-SHA256 한 hex이고, `<본문>`은 보낸 바이트 그대로다. 받은 본문으로 같은 값을 만들어 견주고, 오래된 `t`는 거절한다. `MONTI_SECRET`이 아니다 |

활동 기록은 받는 곳을 사람이 읽는 이름으로 보이고, 저장된 주소는 보이지 않는다(웹훅 주소에는 토큰이 들 수 있다). 이름은 받는 곳의
`label`이고, 없으면 웹훅은 그 이름(이름을 주지 않았으면 호스트), 플러그인의 받는 곳은 그 이름이다. 전송이 실패한 까닭은 네 문장 가운데
하나다: 받는 곳이 답한 상태("503 Service Unavailable"), 답 없음, 받는 곳 없음, 보내지 못함. 답을 받은 플러그인의 받는 곳은
`ReceiverAnswer(status)`를 던져 그 상태가 기록에 보이게 한다. 다른 오류는 "보내지 못함"이고 그 글은 저장하지 않는다.

플러그인의 받는 곳은 같은 것을 인자로 받는다: `send(event, signal, { id, attempt })`. `monti deliveries:run`은 돌고 있는 사이트만 보낼 수 있는
전송(Next 어댑터의 캐시 갱신)을 시도하지 않고 남기며, 몇 건을 남겼는지 말한다.

활동 기록(`activity.list`, `activity.get`)은 모든 쓰기를 한 줄로 보인다. 무엇을 했는지(`summary`), 어디서(`where`), 전송이 어떻게 됐는지다.
어시스턴트의 제안을 한 번 적용해 생긴 쓰기들은 한 줄이고 함께 되돌린다(`activity.undo`. 제안 하나를 통째로 되돌릴 수도 있다). 되돌리기는
쓰기처럼 되돌릴 레코드를 붙잡고 하므로, 보지 못한 저장 위에 덮어쓰지 않는다.

레코드 종류(`defineRecordKind`)는 엔진에게 레코드의 상태를 읽는 법과 옛 상태로 되돌리는 법을 알려 준다.

## 입구

| 입구 | 누가 | 쓰기 |
|---|---|---|
| `createAdminApi(monti, { authenticate })` | 관리자 화면 | 바로 실행 |
| `agentTools(monti)`, `callAgentTool(...)` | 어시스턴트 | 제안 항목이 된다. `monti.proposals.apply`가 나중에 같은 길로 실행한다 |
| `runCli(monti, argv, io)` | 터미널의 개발자 | 바로 실행 |

`humanOnly`인 기능은 에이전트 도구가 되지 않는다. `screen` 기능은 브라우저가 실행하고 서버는 실행하지 않는다.

## 스키마와 명령줄

사이트에는 파일이 둘 있다. `monti.schema.ts`는 사이트 코드가 기대는 구조 값(컬렉션, 필드, 공개 주소)을 관리자가 다시 쓸 수 있는 순수한 값
하나로 담는다. `monti.config.ts`는 그것을 가져오고 데이터베이스를 적는다.

```ts
import { defineConfig } from "@monti-cms/core";
import schema from "./monti.schema";

export default defineConfig({ schema, database: process.env.DATABASE_URL, auth: { password: true } });
```

`auth`는 관리자 한 명이 들어오는 방법이다. `password: true`, `github: { clientId, clientSecret, admin }`, 또는 둘 다다. 비밀번호 방식이면 관리자
화면의 첫 방문에서 관리자를 만든다. 관리자 API(`createAdminApi`)는 `httpOnly` 세션 쿠키가 없으면 로그인 기능만 받는다. 세션은 30일 동안 쓰지
않으면 끝난다. 잊은 비밀번호는 서버에서 `monti admin:reset-password`로 바꾼다.

개발 서버(`monti.schema.ts`를 쓸 수 있는 서버)에서는 이 컴퓨터의 브라우저가 로그인 없이 들어오고, 관리자 화면의 사이드바가 그렇다고 말한다.
브라우저는 루프백 주소에서 받은 일회용 표로 제 자리를 증명한다(`devProof`. `@monti-cms/next` 같은 어댑터가 가져오고, 없으면 아무도
들여보내지 않는다). 요청이 스스로 말하는 것은 증명이 아니다. 운영 사이트와 호스팅 환경의 프로세스에는 적용되지 않는다. 로그인 화면을
로컬에서 써 보려면 `auth: { devBypass: false }`로 끈다.

표시 이름, 도움말, 배치, 편집기 허용은 데이터베이스의 관리자 값이다(`collections.updateAdminValues`). 운영 사이트에서도 고칠 수 있다.

구조는 개발 서버에서만 바꾼다. `schema.plan`은 초안이 무엇을 바꾸고 저장된 값에 대해 검토에서 무엇을 골라야 하는지 보인다. `schema.apply`는
`monti.schema.ts`와 `monti/changes`의 변경 파일을 쓰고 적용한다. 운영 사이트는 배포할 때 같은 변경 파일을 따르고, 구조를 바꾸는 길은 없다.

```sh
monti db:setup          # 표를 만들고 모든 변경 파일을 따른다
monti db:migrate        # 배포할 때: 이 데이터베이스가 아직 안 따른 변경 파일을 따른다
monti deliveries:run    # 때가 된 웹훅 다시 보내기
monti trash:purge       # 휴지통에 30일 있던 것과 주인 없는 파일 지우기
monti admin:reset-password  # 관리자 비밀번호를 바꾸고 모든 브라우저를 로그아웃
monti backup [--media] [--out file.zip]  # 사이트 전체를 zip 하나로. --media는 미디어 파일도 담는다
monti restore file.zip  # 빈 데이터베이스에서만: 있던 그대로 되살리거나, 문제를 모두 말하고 아무것도 쓰지 않는다
monti help              # 모든 기능, 기능마다 명령 하나
monti schema.read
```

## 글과 사이트 읽기

글에는 고치는 본이 있고, 발행하면 발행본이 생긴다. `entries.save`는 고치는 본을 바꾸며 읽은 버전을 받는다. 그래서 어느 입구도 자기가 못 본
저장을 덮어쓰지 못한다. `entries.publish`는 고치는 본을 사이트로 복사하고, 빈 주소는 제목으로 만든다. 발행된 주소를 바꾸면 옛 주소는 새 주소로
넘어간다. `entries.checkPublish`는 발행이 읽는 할 일 목록 하나다. 플러그인은 `publishChecks`로 줄을 더한다.

사이트는 발행본만 읽는다.

```ts
import { createReader } from "@monti-cms/core";

const site = createReader({ db, schema, secret: process.env.MONTI_SECRET });
await site.entry({ collection: "post", locale: "ko", slug }); // { entry } | { redirect } | null
await site.entries({ collection: "post", locale: "ko" });
await site.page({ collection: "post", locale: "ko", limit: 10, after }); // { entries, next }: 목록을 나눠 읽는다
```

글마다 공개 주소(`path`)가 함께 온다. `entries.previewLink`는 `MONTI_SECRET`으로 서명한 한 시간짜리 표와 그 표로 열 주소를 준다. 구조에
미리보기 페이지의 주소가 있으면(`previewPath: "/preview/:slug"`, 본문이 있는 컬렉션) 그 주소이고, 없으면 공개 주소다. 그 표를 `preview`로
넘기면 그 글의 고치는 본이 그 글의 주소에서만 열린다.

Next.js 사이트에서는 `@monti-cms/next`가 이 연결을 한다. 관리자 페이지, 관리자 API 라우트, 초안 모드의 미리보기, 발행할 때의 캐시
갱신이다(`packages/next`, 예제 사이트는 `examples/blog`).

## 본문

본문은 블록이 늘어선 JSON 문서이고, 블록마다 바뀌지 않는 id가 있다. 블록 종류 하나는 `defineBlock` 하나다. 어시스턴트가 읽는 목록
(`blocks.catalog`), 발행 할 일(그 블록의 `check`), 사이트 그리기가 모두 여기서 나온다. 사이트의 블록은 `monti.config.ts`(`blocks`)와
`renderDocument`에 함께 주고, 사이트의 `createElement`도 넘긴다(core는 프레임워크를 가져오지 않는다).

```ts
import { createElement } from "react";
import { renderDocument } from "@monti-cms/core/render";

export const PostBody = ({ entry }) => renderDocument(entry.doc, { createElement, blocks, media: entry.media });
```

`media`는 읽기 API가 주는, 그 글이 쓰는 파일이다. 그림은 자기 크기로, 또는 글쓴이가 px나 본문 폭의 %로 정한 너비로 그려지고, 본문이 더 좁으면
본문에 맞춰 줄어든다(`max-width: 100%`). 자기 이미지 컴포넌트를 쓰는 사이트는 이미지 블록에 `Site` 컴포넌트를 주면 `image`를 받는다. 바로 그릴 수
있는 그림 하나(`src`, `width`, `height`, `widthPercent`, `alt`, `placeholder`, `frame`, `original`)다. 미디어 필드의 그림도
`siteImage(entry.values.cover, entry.media)`로 같은 모양을 받는다.

```tsx
import Image from "next/image";
import { imageFrameStyle, type SiteImage } from "@monti-cms/core/render";

export function Picture({ image }: { image: SiteImage }) {
  const width = image.widthPercent === null ? image.width : `${image.widthPercent}%`;
  const blur = image.placeholder ? { placeholder: "blur" as const, blurDataURL: image.placeholder } : {};
  if (!image.frame)
    return <Image src={image.src} width={image.width} height={image.height} alt={image.alt} style={{ width, maxWidth: "100%", height: "auto" }} {...blur} />;
  // A cropped or turned picture: a box of the shape that shows, holding the whole file.
  const style = imageFrameStyle(image.frame);
  return (
    <span style={{ ...style.box, width, maxWidth: "100%" }}>
      <Image src={image.src} width={image.original.width ?? image.width} height={image.original.height ?? image.height} alt={image.alt} style={style.picture} />
    </span>
  );
}
```

어시스턴트는 `body.read`(블록 id와 서식 없는 글자)로 본문을 읽고 `body.edit`(블록 연산)로 고친다. 본문 전체를 다시 쓰지 않는다. 사람의 저장과
블록 연산은 같은 검사를 지난다. 템플릿은 사이트 전체에 하나의 목록이다(`templates.*`).

글로 가는 링크는 `monti:entry/<번역 묶음 id>`다(`entryLink`). 그래서 글 주소가 바뀌어도 끊기지 않는다. 읽기 API의 `linkPaths(doc, locale)`를
`renderDocument`의 `entryPath`로 넘기고, 사이트에 없는 글로 가는 링크는 글자만 그린다.

제목은 글자로 만든 `id`와 함께 그린다(어느 언어의 글자든 남고, 같은 글자가 또 나오면 번호가 붙는다). `tocOf(doc, { min, max })`는 그
`id`로 목차를 준다. 따로 말하지 않으면 2 · 3단계 제목의 `{ id, text, level, depth }`다.

### 코드 블록

코드 블록은 코드를 글자로 가지고, 언어, 파일 이름(`title`), 사이트에서 줄 번호를 보일지, 줄 범위에 건 줄 효과(`highlight`, `focus`, `plus`,
`minus`, `warning`, `error`, `collapse`, 그리고 코드 링크가 가리키는 라벨 `anchor`), 정규식 규칙을 가진다. 굵게, 기울임, 취소선, 밑줄,
접기(`codeFold`), 툴팁(`codeTip`)은 코드 안의 서식이다. 본문의 코드 링크는 서식 `codeRef { block, anchor }`이고, 가리키던 줄이 없으면
발행을 막는다.

`monti.config.ts`의 `codeBlock`이 Shiki 테마 둘, 편집기가 내놓는 언어, 편집기의 도구, 줄 효과를 정한다:

```ts
codeBlock: {
	themes: { light: "github-light", dark: "github-dark" },
	languages: ["ts", "tsx", "bash", "json"],
	tools: { rules: false }, // rules, fold, tooltip, textStyles, links: false가 아니면 켜져 있다
	lineEffects: [{ name: "info", label: "정보", class: "line-info", editor: { tone: "neutral", marker: "i" } }],
},
```

사이트는 같은 색을 한 번 열어 `renderDocument`에 넘긴다. `@monti-cms/core/render.css`가 기본 모양(일반 CSS)이고, `@monti-cms/next`의
`<CodeTools />`가 누르는 일(복사, 코드 링크)을 한다:

```ts
import { codeHighlighter } from "@monti-cms/core/code";
export const code = codeHighlighter(config.codeBlock); // 약속(promise)이다: 페이지가 `await code`
renderDocument(entry.doc, { createElement, code: await code, locale: entry.locale });
```

## 플러그인

플러그인은 `monti.config.ts`의 코드다(`plugins: [seo(), …]`): `definePlugin({ name, … })`. 더할 수 있는 것:

| 키 | 더하는 것 |
|---|---|
| `operations`, `recordKinds`, `streams` | core의 것과 같은 기능: 관리자 API 경로, 에이전트 도구, CLI 명령 |
| `blocks`, `marks` | 본문 블록과 서식 |
| `fields` | 문서 컬렉션의 필드. 속성 패널에서 플러그인의 탭에 선다(`{ tab, collections?, fields, columns? }`). `monti.schema.ts`에 적히지 않는다. `columns`는 목록이 열로 내놓을 필드다. 필드는 제 입력(`input`)을 가리킬 수 있고, `{ kind: "view" }` 필드는 값 없이 화면 하나를 그린다 |
| `publishChecks` | 발행 전 할 일의 줄 |
| `beforeSave` | 글이 저장될 값을 바꾸거나(돌려준다) 저장을 막는다(`CheckError`를 던진다. `says("…")`가 말을 그대로 싣는다) |
| `textCheck` | 본문 글자의 검사. 편집기 상태 표시줄의 칸에 보인다 |
| `receivers` | 쓰기 뒤에 이벤트가 가는 곳. `receiverFetch(url, init)`로 보내면 기록이 상대의 답을 말한다 |
| `keyServices`, `keys` | 키를 넣을 수 있는 서비스와 플러그인의 키 자리. 자리는 키 화면의 줄이고 서버에서 `monti.plugins.key(plugin, slot)`로 연다 |
| `toolPages`, `importers` | 도구 페이지의 탭, 가져오기가 읽는 파일 형식 |
| `storage` | 미디어 파일을 두는 곳 |

플러그인이 관리자 화면에 그리는 것(필드의 입력, 화면, 도구 페이지의 화면)은 브라우저 쪽 절반에서 온다. `@monti-cms/admin`의
`defineAdminPlugin`으로 만들어 관리자 페이지에 넘긴다(`<AdminPage plugins={[…]} />`). 편집기 ⋯에 서는 문서 보기(`documentViews`)도 여기서 온다.
`@monti-cms/seo`와 `@monti-cms/mdx`가 이 위에 만든 플러그인이다.

## 백업, 내보내기, 가져오기

- `data.backup`은 사이트를 백업의 글자 파일들(글과 발행본과 관계, 폴더, 미디어 기록, 주소, 템플릿, 관리자 값)과 미디어 파일마다의 주소로
  준다. 관리자 화면이 브라우저에서 zip으로 묶고, `monti backup`이 같은 zip을 쓴다. 휴지통, 활동 기록, 대화, 키는 담지 않는다.
  `data.export`는 고른 글과 그 글이 가리키는 것을 같은 모양으로 준다. 어시스턴트의 도구로서는 둘 다 요약만 답한다.
- `monti restore`는 백업을 빈 데이터베이스에 행 그대로 넣는다. 먼저 파일 전체를 검사하고, 문제가 하나라도 있으면 아무것도 쓰지 않는다.
- `data.inspect`는 올린 파일을 컬렉션 하나에 대해 읽고 아무것도 쓰지 않는다. `data.import`는 그 글을 초안으로 가져온다(본문이 같으면
  건너뛰고, 겹치는 주소에는 `-2`를 붙이고, 관계 값에 없는 항목은 만들고, 파일 안의 그림은 미디어 파일이 된다). 가져오기 한 번은 활동 기록의
  한 줄이고 통째로 되돌린다. core는 Monti의 파일만 읽고, 다른 형식은 플러그인의 `importers`가 더한다(`.md`, `.mdx`는 `@monti-cms/mdx`).

## 테스트

```sh
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test
```

테스트 파일마다 테스트 데이터베이스에 자기 스키마를 만든다. 테스트 이름은 그 테스트가 지키는 기능 문서의 끝 조건 번호로 시작한다(`00-1 …`).
