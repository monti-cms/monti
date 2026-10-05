# @monti-cms/syntax-shiki

[English](README.md) | 한국어

`@monti-cms/core`의 Shiki 코드 표기 확장. Shiki용으로 쓴 글은 `const a = 1 // [!code ++]`처럼 주석으로 코드 줄에 표시를 한다
([Shiki transformers](https://shiki.style/packages/transformers) 참고). 이 패키지는 본문을 해석할 때 그 표기를 읽어 Monti 자체 코드 주석(`// @line plus`,
core README의 "코드 블록 줄 효과")으로 바꾼다.

**읽기만 한다.** Shiki 표기는 가져올 때 변환할 뿐 쓰지 않는다. 본문은 언제나 Monti 주석으로 저장하므로
글을 저장할 때마다 한 편씩 옮겨 가고, 저장된 MDX는 확장 없이도 읽힌다.

## 설치

아직 npm에는 없다. 공개 전까지는 저장소 README에 적은 대로 `release` 브랜치의 배포 묶음을 GitHub 주소로 설치한다(pnpm만).

```json
{
	"dependencies": {
		"@monti-cms/syntax-shiki": "github:monti-cms/monti#release/v0.1.0&path:/syntax-shiki"
	}
}
```

피어 의존성으로 `@monti-cms/core`가 필요하다.

## 등록

`mdx.syntax`에 확장을 나열한다.

```ts
// cms.config.ts
import { defineConfig } from "@monti-cms/core";
import { shikiNotation } from "@monti-cms/syntax-shiki";

export default defineConfig({
	// …
	mdx: { syntax: [shikiNotation()] },
});
```

| 옵션 | 기본값 | 뜻 |
| --- | --- | --- |
| `word` | `"strong"` | `[!code word:…]`가 바뀔 글자 효과(`"strong"`·`"em"`·`"del"`·`"u"`). `false`면 `word` 표기를 그대로 둔다. |

공개 렌더러(`@monti-cms/core/render`)는 코드 주석을 읽기 전에 확장의 remark 플러그인을 돌리므로, Shiki 표기가 남아 있는 글도 저장하기 전에 올바르게 그려진다.

## 바꾸는 표기

| Shiki | Monti |
| --- | --- |
| `// [!code ++]` | `// @line plus` |
| `// [!code --]` | `// @line minus` |
| `// [!code highlight]`, `// [!code hl]` | `// @line highlight` |
| `// [!code error]`, `// [!code warning]` | `// @line error`, `// @line warning` |
| `// [!code focus]` | 사이트가 `codeBlock.lineEffects`에 `focus` 줄 효과를 정의했으면 `// @line focus`, 아니면 `// @line highlight` |
| `// [!code info]` | 사이트가 `info` 줄 효과를 정의했으면 `// @line info`, 아니면 그대로 둔다 |
| `[!code ++:3]`(개수가 붙은 모든 줄 효과) | `// @line plus {2-4}`: 이 줄과 다음 두 줄. 코드 줄 번호(0부터)의 닫힌 범위다 |
| `[!code word:foo]` | `// @char strong {re:/foo/g}`, 정규식 글자 규칙(아래 참고) |

```ts
const a = 1
const b = 2 // [!code --]
const b = 3 // [!code ++]
```

은 다음이 된다.

```ts
const a = 1
// @line minus
const b = 2
// @line plus
const b = 3
```

- **표기를 읽는 곳.** 코드 펜스 언어의 줄 끝 주석이며 따옴표 밖에서 찾는다. `//`와 `/* … */`(기본), `#`(python, yaml, toml, bash, sh, zsh, ruby, perl, r, dockerfile, makefile, powershell 등),
  `--`(sql, lua, haskell), `<!-- … -->`(html, xml, svg, vue, svelte, astro, markdown)이다. 문자열 안의 `[!code ++]`처럼 표기처럼 보일 뿐인 글자와 Shiki가 모르는 표기는 그대로 둔다.
  여러 줄에 걸친 문자열은 따라가지 않으므로 그 뒤의 줄 끝 주석은 놓칠 수 있다.
- **줄 끝 주석과 줄 전체 주석.** 표기와 그 주석을 지우고, 다른 주석 글이 남으면 그대로 둔다. 줄 끝 표기는 그 줄에 적용된다.
  표기만 있는 주석은 줄째 지우고 다음 코드 줄에 적용한다. 같은 줄에 여러 표기가 겹칠 수 있다.
- **개수.** `:N`은 코드 N줄을 덮는다. 줄 번호는 코드 줄만 센다. 지운 표기 줄과 Monti 주석 줄은 세지 않는다. 코드 끝을 넘는 개수는 잘린다.
  줄 범위(`{a-b}`)는 절대 번호이므로 같은 코드 블록에서 범위를 쓰는 Monti 주석과 섞어 쓰지 않는다.
- **들여쓰기.** 주석은 적용되는 줄의 들여쓰기를 따른다.
- **`word`.** Monti에는 단어 강조 효과가 없어 가장 가까운 글자 효과를 쓴다(기본은 굵게, `word` 옵션으로 바꾼다). 단어는 정규식 규칙이 된다. 개수 없는 `[!code word:foo]`는 그 줄부터 끝까지의 모든 줄을 덮고
  (첫 줄이면 코드 전체를 덮는 `@document` 규칙), `[!code word:foo:2]`는 그 줄 수만큼 덮는다.
- **`focus`.** Monti에는 기본으로 집중 효과가 없다. `codeBlock.lineEffects`에 `focus`라는 줄 효과를 더하면 쓰이고, 없으면 집중 줄은 강조로 바뀐다.
- 표기가 없는 코드는 건드리지 않는다.

## 확장을 직접 쓰려면

이 패키지는 `remarkPlugins`만 있는(쓰는 쪽이 없는) 작은 `SyntaxExtension`이다. `@monti-cms/core/syntax`에서만 가져온다. core README의 "문법 확장 만들기"을 본다.
