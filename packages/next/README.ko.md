# @monti-cms/next

Next.js 사이트(App Router, Next 16)에 Monti를 붙인다. 관리자 화면은 사이트의 페이지 하나이고, 관리자 API는 라우트 하나다. 미리보기는 초안
모드로 열리고, 발행하면 사이트가 저장해 둔 페이지가 새로 그려진다. 예제 사이트 [`examples/blog`](../../examples/blog)가 여기 있는 것을 모두
쓴다.

## 파일 세 개

```ts
// lib/monti.ts
import { openSite } from "@monti-cms/next";
import config from "../monti.config";

export const { monti, reader } = openSite(config);
```

```tsx
// app/admin/page.tsx
import { AdminPage } from "@monti-cms/next/admin";

export default () => <AdminPage siteName="내 블로그" />;
```

```ts
// app/admin/api/[...path]/route.ts
import { adminRoute } from "@monti-cms/next";
import { monti } from "@/lib/monti";

export const { GET, POST, PUT } = adminRoute(monti);
```

관리자 페이지가 놓인 폴더가 관리자 주소다(`app/admin`이면 `/admin`). 관리자 API는 그 아래 `api`다. 주소를 바꾸려면 폴더 이름을 바꾼다.

## 페이지

사이트의 페이지는 사이트의 것이다. `entryPage`가 페이지에 쓸 글 하나를 읽는다.

```tsx
// app/posts/[slug]/page.tsx
import { renderDocument, tocOf } from "@monti-cms/core/render";
import { entryPage } from "@monti-cms/next";
import { createElement } from "react";
import { reader } from "@/lib/monti";

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
	const post = await entryPage(reader, { collection: "post", slug: (await params).slug });
	return (
		<article>
			<h1>{post.title}</h1>
			{post.doc && renderDocument(post.doc, { createElement, media: post.media, entryPath: post.entryPath })}
		</article>
	);
}
```

- 그 주소에 글이 없으면 `notFound()`다. 그 글이 전에 쓰던 주소면 지금 주소로 `permanentRedirect()`한다.
- `locale`을 주지 않으면 원문 언어다. `reader.locales()`가 사이트의 언어를 준다.
- `reader.page({ collection, locale, limit, after })`는 목록을 나눠 읽고, `reader.entries`는 전부 읽는다. 글마다 공개 주소(`path`)가 있다.
- `tocOf(post.doc)`가 목차를 준다. `renderDocument`가 그리는 제목에 같은 `id`가 붙는다.

## 미리보기

편집기의 "미리보기"는 `<관리자 주소>/api/preview?token=…&path=…`를 연다. 표가 맞으면 그 브라우저에 Next의 초안 모드를 켜고 글의 공개
주소로 간다. 거기서 `entryPage`가 고치는 본을 읽는다. 다른 사람에게는 보이지 않고, 그동안 연 다른 글은 사이트에 보이는 그대로이며, 표는
한 시간 뒤 끝난다.

- 사이트의 레이아웃에 `<PreviewBar />`를 넣으면 미리보기 중에 한 줄이 보이고, 거기서 끝낸다(두 낱말은 `labels`로, 관리자가 `/admin`이
  아니면 `admin`으로 준다). 넣지 않아도 미리보기는 된다.
- 미리보기 페이지를 따로 만든 사이트는 그 주소를 구조에 적고(본문이 있는 컬렉션의 `previewPath: "/preview/:slug"`. 관리자 화면의 설정에서도
  고친다), 그 페이지에서 `previewPage`로 글을 읽는다. 미리보기를 열지 않은 사람에게는 없는 페이지다.

## 사이트의 캐시

`openSite`는 받는 곳 하나를 건다. 사이트에 보이는 것이 바뀌면(글이 발행되거나 사이트에서 내려감, 파일이 바뀌거나 휴지통에 가거나 돌아옴)
사이트가 저장해 둔 모든 페이지를 새로 그리게 표시한다. 그 글의 페이지만이 아니라 전체다. 목록, 카테고리 이름을 보이는 글, 원문을 따르는
번역도 그 글을 보이기 때문이다. 페이지는 다음에 열릴 때 새로 그려진다.

이 표시는 그 서버 프로세스의 캐시에 한다. 프로세스나 기계 여럿으로 띄운 사이트는 함께 쓰는 캐시(Next의 cache handler)가 있어야 한다.
기본 캐시로는 한 프로세스에서 발행한 글이 다른 프로세스에서는 옛 내용으로 남는다.

## 개발 서버와 운영 사이트

`next dev`이고 `monti.schema.ts`를 쓸 수 있으면 개발 서버다. 그 밖은 모두 운영 사이트다.

| | 개발 서버 | 운영 사이트 |
|---|---|---|
| 구조(컬렉션, 필드, 주소) | 관리자 화면에서 고치고 `monti.schema.ts`에 써진다 | 잠긴다 |
| 로그인 | 이 컴퓨터의 브라우저는 로그인 없이 들어온다(`auth: { devBypass: false }`로 끈다) | 늘 한다 |
| 관리자 API가 처음 불릴 때 | 손으로 고친 구조 파일을 따르고 그렇게 알린다 | 데이터베이스가 뒤처졌으면 `monti db:migrate`를 돌리라고 알린다 |

브라우저는 일회용 표로 이 컴퓨터에 있다는 것을 증명한다. 표는 루프백 주소에만 듣는 서버에서 받고, 그 주소는 컴퓨터 밖에서 닿지 않는다.
요청이 스스로 말하는 것(`Host`, `X-Forwarded-For`)으로는 아무도 들어오지 못한다. 보내는 쪽이 적는 값이기 때문이다. 표를 받지 못하면(다른
컴퓨터, 컨테이너 안의 서버) 로그인 화면이 뜬다.

## 스타일

`AdminPage`가 관리자 화면의 스타일(`@monti-cms/admin/styles.css`)을 함께 싣는다. 이 스타일은 관리자 밖을 건드리지 않는다. 모든 규칙이
관리자가 있는 문서 안에서만 걸리고, 변수 · 키프레임 · 글꼴이 모두 자기 것이다. 반대쪽은 사이트가 지킨다. 관리자 화면은 같은 앱의 페이지라서,
사이트가 태그 이름으로 쓴 규칙(`main { max-width: … }`, `td { border: … }`)이 관리자 화면에도 걸린다. 사이트의 스타일은 예제의 `.site`처럼
사이트의 레이아웃 아래에 둔다.
