# @monti-cms/syntax-directive

[English](README.md) | 한국어

`@monti-cms/core`의 지시자(directive) 문법 확장. 표준 MDX 이전에 Monti가 쓰던 표기(`:::callout{…}`·`::image{…}`·`:u[글자]`·`::::table`)를 읽고 쓴다.
지시자 본문이 있는 사이트는 계속 읽을 수 있고, 지시자로 계속 저장하거나 글을 저장할 때마다 표준 MDX로 옮겨 갈 수 있다.

이 패키지가 없으면 저장하는 MDX는 표준(CommonMark + GFM + MDX JSX)이다. 기본으로 쓰는 표기와 문법 확장이 일하는 방식은 core README의 "본문 문법"을 본다.

## 설치

아직 npm에는 없다. 공개 전까지는 저장소 README에 적은 대로 `release` 브랜치의 배포 묶음을 GitHub 주소로 설치한다(pnpm만).

```json
{
	"dependencies": {
		"@monti-cms/syntax-directive": "github:monti-cms/monti#release/v0.1.0&path:/syntax-directive"
	}
}
```

피어 의존성으로 `@monti-cms/core`가 필요하다.

## 등록

`mdx.syntax`에 확장을 나열한다. 순서가 쓰기 우선순위다.

```ts
// cms.config.ts
import { defineConfig } from "@monti-cms/core";
import { directiveSyntax } from "@monti-cms/syntax-directive";

export default defineConfig({
	// …
	mdx: { syntax: [directiveSyntax()] }, // 지시자를 읽고 쓴다
});
```

읽기 전용. 표준 MDX로 저장하므로 글을 저장할 때마다 한 편씩 옮겨 간다.

```ts
mdx: { syntax: [directiveSyntax({ write: false })] },
```

| 옵션 | 기본값 | 뜻 |
| --- | --- | --- |
| `write` | `true` | `true`는 표기로 나타낼 수 있는 내용을 지시자로 쓴다. `false`는 지시자를 읽기만 하고 표준 MDX(JSX)로 쓴다. 지시자처럼 보이는 글자(`:u`)는 두 모드 모두 이스케이프(`\:u`)한다. 확장이 지시자를 계속 읽기 때문이다. |

공개 렌더러(`@monti-cms/core/render`)도 확장의 remark 플러그인을 돌리므로 편집기가 읽은 대로 사이트에 그려진다.

## 다루는 표기

| 표기 | 뜻 | 예 |
| --- | --- | --- |
| `:::이름{속성}` … `:::` | 컨테이너 블록. 겹칠 때는 콜론을 늘린다(`::::tabs` 안에 `:::tab`) | `:::callout{variant="tip"}` |
| `::이름{속성}` | 리프 블록 | `::image{mediaId="…" alt="…"}`, `::file{mediaId="…"}` |
| `:이름[라벨]{속성}` | 글자 꾸밈 | `:u[글자]`, `:sup[2]`, `:sub[i]`, `:untranslated[글자]`, `:tooltip[용어]{content="…"}` |
| `::::table` 안의 `:::row`, `::cell[…]{header colspan=2}` | GFM으로 나타낼 수 없는 표(셀 병합·열 너비·GFM이 아닌 머리글). 나머지 표는 GFM 그대로다 | |

- 지시자 이름이 있는 사이트의 모든 블록(블록 정의의 `syntax: { kind: "container" | "leaf" | "text", directive: "이름" }`)을 다룬다. 본체 블록,
  `@monti-cms/blocks` 같은 플러그인의 블록, 사이트 설정의 `blocks`가 모두 해당한다. 불리언은 참일 때 이름만 쓰고(`{open}`) 거짓이면 생략한다.
- 등록되지 않은 블록의 `:이름`은 그냥 글자로 남는다(`openai/gpt-oss-120b:free를`, `1:1로`). 등록되지 않은 컨테이너·리프는 원문 그대로 두었다가 그대로 다시 쓴다.
- 줄바꿈은 `:br[]`로 쓰지 않고 언제나 `<br />`로 쓴다. `:br[]`은 읽는다.
- 읽은 지시자는 표준 표기가 만드는 것과 같은 MDX 요소가 되므로, 참조 수집과 검사가 두 표기에서 같게 동작한다.
  내용 해시(해석한 본문을 해시한다)도 글을 다른 표기로 저장해도 바뀌지 않는다.

## 업그레이드

이 패키지가 생기기 전에는 `@monti-cms/core/syntax`가 `directiveSyntax`를 내보냈다. 이제는 이 패키지만 내보낸다.

```diff
-import { directiveSyntax } from "@monti-cms/core/syntax";
+import { directiveSyntax } from "@monti-cms/syntax-directive";
```

core 옆에 이 패키지를 설치하고 import만 바꾼다. 동작과 옵션은 그대로다.

**지시자 본문이 있는 사이트**는 `mdx.syntax`에 이 확장을 반드시 둔다. 없으면 기존 글이 지시자 문자 그대로 그려지고 검사에도 걸린다
(`:::callout{…}`의 `{…}`를 표현식으로 읽는다). 표준 MDX로 옮기려면 `directiveSyntax({ write: false })`를 쓰고, 저장된 본문 어디에도 지시자가 남지 않으면 확장을 뺀다.

## 문법 확장 직접 만들기

이 패키지는 `@monti-cms/core/syntax`의 실험적 `SyntaxExtension` 인터페이스의 참고 구현이며, core에서 그 밖의 것은 가져오지 않는다. core README의 "문법 확장 만들기"를 본다.
