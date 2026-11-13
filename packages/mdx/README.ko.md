# @monti-cms/mdx

[English](README.md) | 한국어

Monti의 MDX 플러그인. 가져올 때 `.md`, `.mdx` 파일(`:::지시문` 블록 포함)을 본문으로 읽고, 본문을 MDX로 다시 씁니다.

```ts
// monti.config.ts
import { defineConfig } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";

export default defineConfig({
	// …
	plugins: [mdx()],
});
```

```tsx
// app/admin/page.tsx
import { mdxAdmin } from "@monti-cms/mdx/admin";
import { AdminPage } from "@monti-cms/next/admin";

export default function Page() {
	return <AdminPage plugins={[mdxAdmin]} />;
}
```

첫째는 플러그인의 서버 쪽입니다. 이것이 있으면 컬렉션 목록의 가져오기("+ 새 글 쓰기 ▾ › 가져오기")가 `.md`, `.mdx` 파일을 읽습니다. 파일
하나여도 되고, 그림과 함께 묶은 zip이어도 됩니다. 둘째는 브라우저 쪽으로, 편집기 ⋯에 "MDX로 보기"를 더합니다. 패키지가 설치되어 있으면
`npx monti init`이 둘 다 써 줍니다.

Monti는 본문을 JSON 문서로 둡니다. MDX는 가져올 때 한 번 읽을 뿐, 저장되는 모양이 아닙니다.

## 무엇을 읽나

| 파일에서 | 본문에서 |
|---|---|
| front matter | 파일의 키. 가져오기 시트에서 컬렉션의 필드에 맞춥니다 |
| 소제목 | 소제목 블록, 2~4단계(`#`는 2단계) |
| 문단, 굵게, 기울임, 취소선, 인라인 코드, 링크, `<u>`, `<sup>`, `<sub>`, 줄바꿈 | 그 서식이 붙은 문단 |
| 목록, 체크 목록, 인용, 표, 구분선, 각주 | 각각의 블록 |
| 코드 울타리 | 코드 블록. 글자는 쓴 그대로이고, 울타리 줄의 나머지는 언어 값에 남습니다 |
| 한 줄을 혼자 차지한 그림 | 그림 블록. 올린 파일에 든 그림은 미디어로 갑니다 |
| 사이트의 블록 이름인 `:::callout{tone="warn"}` | 그 블록과 준 속성 |
| 컴포넌트(`<Tweet />`), 모르는 지시문, HTML 덩어리 | 쓴 그대로 코드 블록(언어 `mdx-kept`, `html-kept`)에 남고, 글에 할 일 "모르는 컴포넌트 Tweet"이 붙습니다(발행을 막지 않습니다) |
| `.mdx` 파일의 `import`, `export` 줄 | 버립니다 |

파일이 따로 적어 둔 주소의 이름으로 건 링크(`[문서][d]`)는 그 주소를 받습니다. 스크립트 주소는 링크가 되지 않습니다.

코드 울타리의 Shiki 표기(`// [!code ++]`, `--`, `highlight`, `focus`, `error`, `warning`, `word:`)는 가져올 때 코드 블록의 줄 효과가 되고, 울타리 줄의 `title="…"`와 `showLineNumbers`는 파일 이름과 줄 번호가 됩니다. 내보낼 때 Shiki에 있는 효과는 그 표기로, 나머지(접기, 라벨, 글자 효과, 규칙)는 Monti 주석(`// @line collapse {0-4}`)으로 나갑니다. 그래서 다시 읽으면 같은 블록입니다. 코드 링크는 `<CodeRef to="c1">글</CodeRef>`이고, 그 라벨을 가진 첫 코드 블록으로 갑니다.

## 쓰기

```ts
import { readMarkdown, toMdx } from "@monti-cms/mdx";

const text = toMdx(doc, { values: { title: "Hello" }, mediaUrl: (id) => `/files/${id}` });
const { values, doc: again, unknown } = readMarkdown(text, { mdx: true });
```

`toMdx`는 본문을 MDX로 씁니다. 사이트의 블록은 지시문으로, 쓴 그대로 남겨 둔 것은 그대로, `values`는 맨 앞에 front matter로 나갑니다.
읽은 것을 다시 쓰고 읽으면 같은 본문입니다.

## 옵션

```ts
mdx({ language: "en" }); // 할 일의 말이 쓰는 언어. 주지 않으면 관리자 화면처럼 한국어
```
