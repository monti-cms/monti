# @monti-cms/mdx

[English](README.md) | 한국어

`@monti-cms/core`의 MDX 확장. 코어는 본문을 문서로 저장하며 글 형식을 따로 갖지 않는다. 이 패키지가 MDX 형식을 더한다.

- **`mdx` 형식**: 읽기·쓰기 API의 `format: "mdx"`, 내보내기와 HTTP API의 `?format=mdx`, AI 플러그인의 모델이 읽고 쓰는 글.
- 공개 화면용 **`renderMdx`**: MDX 글을 문서로 읽어 코어의 렌더러로 그린다(MDX를 컴파일하거나 실행하지 않는다).
- 관리자의 **원문 패널**: 본문을 MDX 글로 고치고, 쓰는 동안 바로 검사한다.
- `@monti-cms/syntax-directive`와 `@monti-cms/syntax-shiki`가 기대는 **문법 확장 API**(`SyntaxExtension` 등).
- 본문을 MDX 글로 저장하던 옛 저장소를 `monti migrate`가 올릴 때 필요한 코드.

## 설치

아직 npm에는 없다. 공개 전까지는 저장소 README에 적은 대로 `release` 브랜치의 배포 묶음을 GitHub 주소로 설치한다(pnpm만).

```json
{
	"dependencies": {
		"@monti-cms/mdx": "github:monti-cms/monti#release/v0.1.0&path:/mdx"
	}
}
```

피어 의존성으로 `@monti-cms/core`와 `react`가 필요하고, 원문 패널에는 `@monti-cms/admin`(선택)이 필요하다. AI 확장(`@monti-cms/ai`)은 이 패키지를 피어로 둔다.

## 등록

사이트 설정의 `plugins`에 `mdx()`를 적고, 스타일은 관리자 스타일 뒤에 가져온다.

```ts
// monti.config.ts
import { defineConfig } from "@monti-cms/core/server";
import { mdx } from "@monti-cms/mdx";
import { directiveSyntax } from "@monti-cms/syntax-directive";

export const cms = defineConfig({
	// …
	plugins: [mdx({ syntax: [directiveSyntax()] })], // 표준 MDX면 `mdx()`만
});
```

```tsx
// 관리자 레이아웃: 미리 만든 관리자 스타일이 원문 패널까지 담고 있다(앱에 Tailwind가 필요 없고 따로 불러올 것도 없다)
import "@monti-cms/admin/styles.css";
```

| 옵션 | 뜻 |
| --- | --- |
| `syntax` | 문법 확장(실험적)을 쓰기 우선순위 순으로 나열한다. 확장의 표기로 쓴 내용은 그 확장이 나열되어 있는 동안에만 읽힌다("문법 확장") |

`mdx()`가 없는 사이트는 문서(`doc`)만 받는다. 글로 쓰면 `unknown_format`으로 실패하고, 관리자에는 원문 토글이 없다.

## 진입점

| 진입점 | 쓰는 곳 | 내용 |
| --- | --- | --- |
| `@monti-cms/mdx` | `monti.config.ts`, 문법 확장 패키지 | 플러그인 `mdx({ syntax })`와 문법 확장 API: 타입(`SyntaxExtension`·`SyntaxContext`·`SerializeContext` 등), `RAW_SOURCE_PARAGRAPH`, 표 도우미, 코드 주석 문법 도우미. 설정이 불러오므로 가볍게 둔다(remark를 가져오지 않는다) |
| `@monti-cms/mdx/format` | 서버 코드, 테스트 | `mdxFormat`, `createMdxFormat({ syntax })`, 그리고 해석·쓰기 API: `analyze`·`serialize`·`toDocument`·`bodyFromMdx`·`bodyFromDocument`·`bodyDocument`·`documentToMdx`·`toStoredDocument`·`fromStoredDocument`·`parseMdxAst`·`insertSoftBreaks`·`readableMdx`·`compareMdxStructure`·`configuredSyntax`·`remarkFenceBlocksToMdx` 등 |
| `@monti-cms/mdx/render` | 공개 화면(서버 컴포넌트) | `renderMdx(source, options)` |
| `@monti-cms/mdx/admin` | 관리자(플러그인이 불러온다) | `MdxSourcePanel`, `EditorToggle`, `createMdxBrowserFormat(site, options)`, 그리고 이를 등록하는 관리자 공급자 |
| `@monti-cms/mdx/server` | 플러그인, 마이그레이션 | `createServerMdxFormat`, `legacyBodies`: 옛 저장소 마이그레이션이 쓰는 것("옛 데이터베이스") |
| `@monti-cms/mdx/testing` | 테스트 | `mdxWith(syntax)`, `docOfMdx(mdx, syntax?)`, `readSamples()`, `renderFixture(source, options)`, 파이프라인 함수의 재내보내기 |

## `mdx` 형식

읽기와 쓰기는 형식을 거치고, 형식이 돌려준 것을 코어가 검사하고 저장한다(코어 README의 "형식" 절). 읽히지 않는 글(해석되지 않거나, `import`·`export`·표현식을 쓰거나, 머리말이 있는 글)은 반쯤만 바꾸지 않는다. 초안은 발견한 것과 함께 `unparsed` 문서로 그 글을 보관하고, 고치기 전까지 발행이 막힌다. 검사 문구는 문구 이름공간 `cms.mdx`에 있다.

저장하는 MDX는 **CommonMark + GFM + 표준 MDX JSX**다. 문법 확장이 없을 때 기본으로 쓰는 표기:

| 뜻 | 쓰는 표기 |
| --- | --- |
| 줄바꿈 | `<br />`(문단에서는 뒤에 줄을 바꿔 `줄<br />` + 줄바꿈 + `다음`). `\` + 줄바꿈, 줄 끝 공백 두 칸, `<br />`을 모두 읽고 이렇게 쓴다. 문단 안의 줄바꿈 한 번은 공개 화면과 편집기 모두에서 공백일 뿐이다(CommonMark) |
| 빈 줄(편집기에서 블록 사이에 Enter를 눌러 만든 줄) | `<br />`만 있는 줄, 빈 문단 하나에 한 줄씩 순서대로. 문서 노드로는 빈 `paragraph`다. 본문 맨 끝의 빈 줄은 쓰지 않는다 |
| 밑줄·위 첨자·아래 첨자·번역 안내 | `<u>`·`<sup>`·`<sub>`·`<Untranslated>` |
| 글 정렬 | `<TextAlign align="center">` |
| 셀 병합·열 너비·GFM이 아닌 머리글이 있는 표 | `<Table>`·`<TableRow>`·`<TableCell colspan="2">`(나머지 표는 GFM) |
| 미디어 이미지, 또는 크기·정렬·캡션·자르기·회전·장식 표시가 있는 이미지 | `<Image mediaId="…" />`(바깥 주소의 보통 이미지는 `![대체글](주소 "제목")` 그대로) |
| 파일 카드 | `<File mediaId="…" />` |
| 컨테이너·리프 블록(콜아웃·탭·단·사이트 블록) | `<컴포넌트 속성>` … `</컴포넌트>`. 불리언은 참일 때 이름만 쓰고 거짓이면 생략한다 |
| 글자 꾸밈(툴팁·코드 연결·글자색·사이트 글자 블록) | `<컴포넌트 속성>글자</컴포넌트>` |

한 가지 뜻에는 쓰는 표기가 하나다. 다른 표기도 글을 읽을 때는 받아들이고, 저장되는 것은 문서다. 코드 블록은 Monti 주석(`// @line plus {0-0}`)으로 써서, MDX를 읽는 다른 도구에서도 주석이 그대로 보인다.
내부 링크는 읽는 사람이 보는 글에서는 대상의 실제 경로(`[x](/en/posts/slug)`)로, 다시 가져올 글(`purpose: "sync"`)에서는 `entry:<id>`로 쓴다.

## `monti doctor`

`mdx()`는 `monti doctor`에 검사 둘을 더한다: `mdx/format`(`mdx` 형식이 등록됐는지)과 `mdx/syntax`(`mdx({ syntax })`의 확장마다 remark 플러그인이 만들어지고 짧은 글이 읽히는지). 실패하면 확장과 고칠 옵션을 짚는다.

## 그리기

```tsx
import { renderMdx } from "@monti-cms/mdx/render";

const entry = (await cms.read.getEntry({ collection: "post", slug, locale })).entry;
const { content, toc, unknown } = await renderMdx(source, { site: cms.site, locale, refs: entry.refs, components });
```

`renderMdx(source, options)`는 `mdxFormat.import(source)` 다음에 코어의 `renderDocument(doc, options)`를 부르는 것이다. 그래서 같은 옵션(`site`·`components`·`refs`·`locale`·`strict` 등)을 받고 `{ content, toc, unknown }`을 돌려준다. 컴파일하거나 실행하는 것은 없다. 형식이 읽지 못하는 글은 믿을 수 있는 부분이 없으므로 던진다.
사이트(`cms.site`)가 글에서 쓸 수 있는 블록을 정하고, `syntax` 옵션의 기본값은 그 사이트의 `mdx({ syntax })`다. 등록된 이미지·파일·내부 링크를 그리려면 `refs: entry.refs`를 넘긴다. 문서를 저장하는 사이트는 이 함수가 필요 없다. `@monti-cms/core/render`의 `CmsContent`와 `renderDocument`가 문서를 바로 그린다(코어 README의 "저장된 문서 그리기").

## 원문 패널

`mdx()` 플러그인은 관리자 공급자로 **원문 패널**과 `mdx` 형식의 브라우저 쪽을 관리자에 등록한다(`useCmsAdminComponents().sourcePanels`, `useFormat("mdx")`). 편집기 도구 줄 끝의 토글이 본문을 시각 편집기와 MDX 글 사이에서 바꾼다. 글은 입력하는 동안 브라우저에서 해석되고, 저장되는 것은 그 글이 읽히는 문서다. 읽히지 않는 글은 발견한 것을 옆에 보이며 `unparsed` 문서로 보관된다.
`plugins`에 `mdx()`가 없으면 원문 토글이 없다. 패널의 문구는 이름공간 `cms-mdx.source`에 있다. 문서가 생기기 전에 브라우저가 저장한 복구 사본(본문이 `form.mdx`의 MDX)은 `unparsed` 문서로 보관되고, 패널이 다시 읽는다.

## 문법 확장

확장은 한 표기의 읽기와 쓰기를 함께 제공해서 표기를 더한다. `mdx({ syntax })`에 나열하며 순서가 쓰기 우선순위다.

- [`@monti-cms/syntax-directive`](../syntax-directive/README.ko.md)는 표준 MDX 이전에 Monti가 쓰던 지시자(`:::callout{…}`·`::image{…}`·`:u[글자]`·`::::table`)를 읽고 쓴다. 없으면 `:::callout`은 그냥 글자다.
  `directiveSyntax({ write: false })`는 지시자를 읽기만 하고 표준 MDX로 저장하므로, 글을 저장할 때마다 한 편씩 옮겨 가게 된다.
- [`@monti-cms/syntax-shiki`](../syntax-shiki/README.ko.md)는 코드 펜스의 Shiki 코드 표기(`// [!code ++]`·`[!code highlight]`·`[!code focus]`)를 읽어 Monti 코드 주석으로 바꾼다. 읽기만 한다.
- 공개 렌더러는 편집기와 같은 확장으로 읽으므로 편집기가 읽은 대로 사이트에 그려진다.

### 문법 확장 만들기(실험적)

이 인터페이스는 실험적이라 마이너 버전에서 바뀔 수 있다.

```ts
interface SyntaxExtension {
	name: string;
	/** 읽기: remark 플러그인(또는 사이트 블록을 받아 플러그인을 돌려주는 함수). */
	remarkPlugins?: PluggableList | ((context: SyntaxContext) => PluggableList);
	/** CmsNode → MDX. 키는 노드 타입(또는 블록의 렌더러 이름), "*"는 나머지. undefined를 돌려주면 다음 확장, 그다음 표준 직렬화기로 넘어간다. */
	fromDocument?: Record<string, (node: CmsNode, context: SerializeContext) => string | undefined>;
	/** 이 확장이 쓰는 마크. 키는 마크 타입이고 넘김 규칙은 같다. `inner`는 이미 쓴 안쪽 내용이다. */
	fromMark?: Record<string, (mark: CmsMark, inner: string, context: SerializeContext) => string | undefined>;
	/** 본문 글자가 이 문법으로 읽히지 않게 이스케이프한다(예: `\:name`). */
	escapeText?: (text: string, context: SerializeContext) => string;
}
```

`SyntaxContext`는 사이트 블록(`blocks.list`·`blocks.byName`·`blocks.byComponent`)과 코드 블록 줄 효과 이름(`codeLineEffects`)을 준다. `SerializeContext`는 여기에 `indent`(노드가 시작하는 줄의 들여쓰기이며 쓰는 쪽이 직접 넣는다),
자식을 쓰는 `serializeBlocks`·`serializeInlines`, `componentName`, `hasSpread`, 표준 표기가 쓰는 속성 목록을 만드는 `nodeAttributes`·`markAttributes`, `escapeAttribute`를 더한다.
줄바꿈은 언제나 `<br />`라서 확장에 넘기지 않는다. `image` 노드는 Markdown으로 쓸 수 없을 때만 넘긴다. 원문 글자를 문단으로 되돌려 그대로 쓰게 하려는 remark 플러그인은 그 문단에 `RAW_SOURCE_PARAGRAPH` 표시를 한다.
루트 진입점은 표나 코드 주석을 쓰는 확장을 위한 표 도우미(`tableHasMergedCells`·`tableWidths`·`formatTableWidths` 등)와 코드 주석 문법 도우미(`resolveCommentSyntax`·`formatAnnotationComment`)도 내보낸다. 지시자 확장(`packages/syntax-directive`)이 참고 구현이다.

## 옛 데이터베이스

본문을 저장 문서로 두기 전의 저장소는 모든 본문을 MDX 글로 들고 있었다. 코어는 그것을 옮기던 단계(`0010`·`0011`·`0012`·`0013`·`0015`)를 옛 이름으로 여전히 두지만 MDX를 해석하지는 않는다. 그 단계들은 `@monti-cms/mdx/server`가 주는 `mdx` 형식(`CmsFormat.legacyBodies`, `@monti-cms/core/format`의 `LegacyBodies` 타입)으로 글을 읽고 쓴다.

- 단계는 그것으로 읽을 본문이 **실제로 있을 때만** 형식을 요청한다. 새 저장소와 이미 그 단계를 지난 저장소는 마이그레이션 때 이 패키지가 필요 없다.
- 필요한데 패키지가 없으면 `monti migrate`는 `@monti-cms/mdx`를 설치하고 사이트 설정의 `plugins`에 `mdx()`를 넣어야 데이터베이스를 올릴 수 있다는 메시지와 함께 실패한다.
- `monti migrate`와 `cms.migrate()`는 인스턴스의 형식(플러그인이 주는 것)을 마이그레이션에 넘기므로, `mdx({ syntax: [...] })`를 설정에 둔 사이트는 알맞은 문법 확장으로 옛 데이터를 옮긴다.
- `entry_bodies.mdx`와 `body_templates.mdx`는 null을 허용하고(`0020_mdx_columns_optional` 단계) 더는 아무도 쓰지 않는다. 열을 지우지는 않으므로 옛 행에는 글이 남는다.

## 코어에 있던 MDX에서 올리기

MDX는 코어에 들어 있었고 `defineConfig({ mdx: { syntax } })`로 설정했다. 배포하기 **전에** 다음을 한다.

1. `@monti-cms/mdx`를 설치한다.
2. `plugins`에 `mdx()`를 넣고 `mdx.syntax`를 그 안으로 **옮긴다**: `plugins: [mdx({ syntax: [directiveSyntax()] }), ...]`(owner 스타일 블로그라면 쓰기 모드를 켠 `directiveSyntax()`. 옵션은 그대로 둔다).
3. 관리자 스타일을 위해 따로 불러올 것은 없다. `@monti-cms/admin/styles.css`가 원문 패널을 담고 있다.
4. `@monti-cms/core/render`의 `renderMdx` import를 `@monti-cms/mdx/render`로 바꾸거나(또는 `CmsContent`로 문서를 그린다), `cms.read.imageResolver(...)`를 `entry.refs`로 바꾼다.
5. `@monti-cms/core/mdx`·`@monti-cms/core/syntax`·`@monti-cms/core/format/mdx` import를 바꾼다. 문법 확장 인터페이스는 `@monti-cms/mdx`에서, 해석기와 직렬화기는 `@monti-cms/mdx/format`에서 가져온다.
6. 직접 만든 블록 확장은 render 모듈의 기본 내보내기를 지우고 `documentComponents`만 둔다.
7. `monti migrate`를 돌린다. `mdx()`가 있으면 옛 데이터베이스가 올라간다. 없으면 돌릴 옛 단계가 남은 저장소는 설치 메시지와 함께 실패한다.
8. 스크립트에서 `monti content:rewrite`를 뺀다. 없어졌다.

바뀐 것 전체는 코어 README의 "코어에 있던 MDX에서 올리기"에 있다.

## 개발

```bash
pnpm --filter @monti-cms/mdx test:run
pnpm --filter @monti-cms/mdx typecheck
```

해석기·쓰기·형식 테스트는 `src/__test__/fixtures/samples`의 예시 글과 함께 이 패키지에 있고, 원문 패널 테스트는 jsdom 환경(`// @vitest-environment jsdom`)에서 돈다. 데이터베이스를 쓰는 테스트가 있으므로 `.env.local`에 `CMS_TEST_DATABASE_URL`이 필요하다(저장소 README 참고).
사이트나 다른 패키지의 테스트가 MDX 글을 필요로 하면 `@monti-cms/mdx/testing`의 도우미를 쓴다. `mdxWith(syntax)`는 주어진 확장 목록으로 파이프라인을 만들고, `docOfMdx(mdx)`는 글의 저장 문서를, `readSamples()`는 예시 글을, `renderFixture(source)`는 글의 마크업·목차·React 트리를 준다.
