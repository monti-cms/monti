# @monti-cms/ai

[English](README.md) | 한국어

`@monti-cms/core`의 AI 플러그인. 이름으로 부르는 AI 기능(생성·판단), 필드 옆 AI 버튼, 번역본 편집기의 AI 번역,
관리자 AI 화면(`<관리자 경로>/ai`, 기본 `/admin/ai`)과 AI API(`/api/cms/v1/ai/*`), AI 표(`ai_action_overrides`·`ai_settings`)를 더한다.
등록하지 않으면 이것들이 모두 없다.

## 등록

사이트 설정의 `plugins`에 `aiPlugin()`을 적는다. 기본 기능은 붙을 곳이 있으면 저절로 켜지고, 다른 플러그인(블록 확장·SEO 확장 등)이
더한 기능도 저절로 붙는다. 바꾸거나 끌 것만 `actions`에 기능 이름(key)으로 적는다.

```ts
import { aiAction, aiPlugin, aiPresets } from "@monti-cms/ai";

plugins: [
	aiPlugin({
		siteDescription: "개인 기술 블로그", // 모든 기능의 맨 앞 지시에 들어간다. 없으면 "웹사이트"
		actions: {
			summary: aiPresets.summary({ maxLength: 120 }), // 바꾸기(같은 이름)
			draft: false, // 끄기
			outline: aiAction({ … }), // 더하기(새 이름)
		},
	}),
],
```

### 기본 기능

| 이름 | 붙는 곳 | 켜지는 조건 |
| --- | --- | --- |
| `slug` | 주소 필드(`fields.slug`) | 본문이 있는 컬렉션에 주소 필드가 있을 때 |
| `summary` | 요약 역할(`role: "summary"`) 텍스트 필드. 글자 수는 필드 `max`(없으면 160) | 본문이 있는 컬렉션에 있을 때 |
| `tags` | 항목 컬렉션(`kind: "item"`)을 가리키는 여러 개 관계 필드. 선택지는 그 대상 컬렉션 | 본문이 있는 컬렉션에 있을 때 |
| `category` | 항목 컬렉션(`kind: "item"`)을 가리키는 하나 관계 필드. 선택지는 그 대상 컬렉션 | 본문이 있는 컬렉션에 있을 때 |
| `imageAlt`·`imageCaption` | 본문 이미지·미디어 화면의 대체 텍스트·캡션 | 언제나 |
| `mediaFilename` | 미디어 화면의 파일 이름 | 언제나 |
| `translate` | 번역본 편집기의 블록 번역. 번역할 블록 속성은 블록 정의(`translatable`)에서 만든다 | 언어가 둘 이상일 때 |
| `codeFold` | 코드 블록 접기 규칙 | 언제나 |
| `polish`·`draft` | 선택 영역 메뉴·넣기 메뉴 | 본문이 있는 컬렉션이 있을 때 |

- 필드 기능은 필드 이름이 아니라 필드 종류·역할·관계 대상으로 붙을 필드를 찾는다(컬렉션마다 하나). 하나/여럿 고르기와
  선택지도 필드에서 온다. `aiPresets.summary({ field: "excerpt", collections: ["article"] })`처럼 이름·컬렉션을 줄 수도 있다.
  태그·카테고리는 `choices: "컬렉션"`으로 대상을 고른다.
- 지시문은 사이트 종류("블로그")나 언어("한국어")를 가정하지 않는다. 자료에서 언어를 알 수 없을 때(이미지 대체 텍스트 등)는
  "콘텐츠 언어"를 쓰고, 실행기가 지시 맨 앞에 콘텐츠 언어(편집 중인 글의 언어, 없으면 사이트 기본 언어)를 붙인다.
- 공통 문구 `styleGuide`(`aiPlugin({ shared: { styleGuide: … } })`)가 있으면 문체 다듬기·초안 쓰기 지시문에 넣는다. 없으면 넣지 않는다.
- 관리자 AI 화면의 기능 순서는 필드 옆 기능이 먼저, 그다음 기본 기능·다른 플러그인 기능·설정에 더한 기능 순서다.
- `aiPresets.이름(옵션)`은 사이트 설정을 보고 기능을 만드는 함수(`AiActionFactory`)를 돌려준다. 붙을 곳이 없으면 켜지지 않는다.

### 다른 플러그인이 더하는 기능

플러그인은 `definePlugin({ contributes: { ai: { actions: { 이름: 정의 또는 만드는 함수 } } } })`로 기능을 더한다(`AiContribution`).
AI 플러그인이 없으면 쓰이지 않으므로 확장은 AI 플러그인을 몰라도 되고, 타입만 읽는다(`import type`). 이미 있는 이름을 더하면
설정 오류다. 사이트는 같은 이름으로 바꾸거나 `false`로 끈다. 블록 확장의 `diagramDraft`·`diagramEdit`(Mermaid)·`chartDraft`·
`chartEdit`(차트), SEO 확장의 `seoTitle`·`seoDescription`이 이렇게 붙는다.

- 기능 하나는 입력(재료)·지시문·결과 모양·검사·붙을 곳(`attach`)이다. `aiAction()`으로 직접 정의할 수 있다.
- 재료(제목·본문·이미지…)는 지시문에 끼우지 않고 따로 보낸다. 자료 태그는 입력 이름 그대로다(`<title>`, `<block>`…).
  지시문의 `{{이름}}`에는 언어 입력만 넣을 수 있다.
- `value` 종류 입력(필드의 현재 값)에 든 값은 후보와 선택지에서 뺀다. 입력 이름은 상관없다.
- 붙을 곳은 관리자 화면의 정해진 자리다(필드 옆·본문 이미지·미디어·코드 블록·번역·선택 영역 메뉴·넣기 메뉴·본문 블록).
  자리가 필수 입력을 채울 수 있어야 한다.
- 관리자 AI 화면에서는 켜기·요청 받기·연결·모델·보낼 입력·지시문·기준값·검사 값만 고친다. 고친 값만 DB(`ai_action_overrides`)에 둔다.
  "기본값으로"는 입력 칸만 기본값으로 되돌리고, 저장은 따로 누른다.
- 실행: `POST /api/cms/v1/ai/run { action, input | inputs, env }`. 관리자 화면에서는 `useAiAction("summary").run({ title, body })`나
  `<AiButton action="summary" input={() => ({ title, body })} onResult={…} />`(`@monti-cms/ai/admin`)처럼 이름으로 부르고,
  이름·입력·결과 타입은 설정에서 나온다.
- 판단 방식(`engine: "decide"`, System One)은 선택지(`choices`)마다 확률을 받아 기준 이상만 후보로 낸다.

## 결과 검사

- **정해진 검사**: 어느 기능에나 쓰는 것만 둔다. 형식(`pattern`)·길이(`maxLength`)·있는 값만(`exists`, 기능의 선택지에 있는 값)·
  선택지 안(`oneOf`, 정해 둔 목록 중 하나). 관리자 AI 화면에서 켜고 끄며 값을 고치고, 어느 기능에든 형식·길이·선택지 안 검사를
  더하거나 삭제한다(정의가 정한 검사는 끄기만 한다).
- **코드 검사(`defineValidator`)**: 기능마다 다른 검사는 함수로 만들어 기능 정의의 `checks`에 함께 넣는다. 관리자 화면에는
  `label`이 보이고 켜고 끌 수만 있다. 정해진 검사 다음에 적힌 순서대로, 서버에서 값 하나(후보 하나, 글·MDX 결과 전체)마다
  부른다. `undefined`·`true`면 통과, `false`나 글자면 버리고(글·MDX는 실패, 글자는 그 이유), `{ detail }`이면 통과하면서
  후보 옆에 설명을 붙인다. 두 번째 인자(`AiValidatorContext`)로 입력·컬렉션·언어(없으면 기본 언어)·고치는 항목·선택지와
  본체 콘텐츠 조회 `content`를 받는다.
- **본체 콘텐츠 조회(`context.content`)**: 실행 API가 본체 공개 API(`@monti-cms/core/plugin/server`의 `createContentLookup`)로
  채운다. 플러그인은 본체 표를 직접 읽지 않는다. 지금은
  `slugsInUse({ collection, locale, slugs, excludeEntryId? })`(같은 컬렉션·언어에서 이미 쓰는 주소)가 있다.
- 기본 코드 검사: `uniqueSlug`(중복 없음, 주소 추천. `content.slugsInUse`로 묻는다), `regexRuns(입력, { name?, scope? })`
  (정규식 실행, 코드 블록 정규식. 규칙 이름·범위는 없으면 문서 전체 접기), `sameStructure(입력)`(구조 유지, 번역).
  블록 확장은 `mermaidSyntax`·`chartSyntax`(`@monti-cms/blocks/mermaid/ai`·`/chart/ai`)를 낸다.
- 검사 파일은 사이트 설정이 불러오므로, 사이트 설정을 읽는 본체 모듈(코드 블록·MDX 읽기)은 `run` 안에서 `await import()`로
  불러온다(맨 위에서 불러오면 설정을 읽는 순서가 꼬인다).

```ts
import { aiAction, defineValidator, uniqueSlug } from "@monti-cms/ai";

const noBannedWords = defineValidator({
	name: "no-banned-words",
	label: "금지어 없음",
	run: (value) => (/광고|협찬/.test(value) ? "금지어가 들어 있습니다." : true),
});

aiAction({
	label: "요약 만들기",
	// …
	checks: [{ kind: "maxLength", max: 160 }, noBannedWords],
});

// 본체 콘텐츠 조회를 쓰는 검사(서버에서 돈다).
const unusedAddress = defineValidator({
	name: "unused-address",
	label: "안 쓰는 주소",
	run: async (value, { collection, locale, entryId, content }) =>
		!collection ||
		!(await content.slugsInUse({ collection, locale, slugs: [value], excludeEntryId: entryId })).has(value),
});
```

## 가짜 연결(개발 전용)

`CMS_AI_FAKE=1`(운영 빌드 제외)이면 키 없이 정해진 답을 준다. 답은 결과 모양과 입력 종류로 만든다(입력 이름은 보지 않는다).
MDX 결과는 MDX 입력을 그대로(흘려받기는 글로 시작하는 문단에 `(fake)` 표시를 붙여), 글 결과는 첫 글 입력으로, 후보는
선택지·코드 입력·글 입력 순으로 만든다. 결과가 정해진 모양이어야 코드 검사를 통과하는 기능(예: 다이어그램)은 정의에
`fake: (입력) => 답`을 둔다(후보 결과면 줄마다 후보 하나). 실제 연결은 `fake`를 부르지 않는다.

## 새 기능

- **흘려받기**: 기능 정의 `stream: true`(생성 방식의 글·MDX 결과)면 결과가 조금씩 보인다. 화면에서는
  `useAiAction("이름").stream(입력, { onText })`. API는 `/ai/run`에 `stream: true`(한 줄에 사건 하나인 JSON).
- **공통 문구**: 여러 기능의 지시문에 `{{shared.키}}`로 넣는 문구(문체 가이드·말투·독자 등). 두 가지가 있다.
  - 설정 문구: `aiPlugin({ shared: { styleGuide: { label: "문체 가이드", text: "…" } } })`. 키·이름은 설정이 정하고,
    관리자 AI 화면 "공통 문구" 탭에서 내용만 고친다("기본값으로"는 입력 칸을 설정 문구로 되돌린다). 삭제할 수 없다.
    설정의 지시문(`prompt`)은 설정 문구만 쓸 수 있다(설정을 만들 때 확인한다).
  - 더한 문구: "공통 문구" 탭의 "문구 추가"로 키(영문자로 시작, 영문자·숫자·`_`)·이름·내용을 적어 더한다. 키는 만든 뒤
    바꿀 수 없고, 설정 문구·다른 문구와 겹치지 않아야 한다. 관리자 화면에서 고친 지시문과 화면 기능이 쓸 수 있다.
    지시문에서 쓰는 기능이 있으면 삭제하지 못한다(그 기능 이름을 알린다).

  둘 다 AI 설정 표의 `shared` 줄에 `{ texts: { 키: 고친 내용 }, added: [{ key, label, text }] }`로 둔다(예전 모양도 읽는다).
  API는 `/ai/shared`: `GET`(목록, `source: "config" | "added"`), `POST { expectedVersion, key, label, text }`(더하기),
  `PATCH { expectedVersion, key, label?, text }`(하나 고치기), `PUT { expectedVersion, texts }`(여럿 고치기),
  `DELETE ?key=&expectedVersion=`(삭제). 모두 바뀐 목록을 돌려주고, 버전이 다르면 409다.
- **문체 다듬기·초안 쓰기**: `polish`(본문에서 글자를 고르면 뜨는 메뉴, 바뀐 곳을 보인 뒤 바꾸기),
  `draft`(슬래시 메뉴·빈 문서 툴바, 커서 자리에 넣기). 공통 문구 `styleGuide`가 있으면 저절로, 다른 키면
  `aiPresets.polish({ styleGuide: "키" })`로 문체 가이드를 넣는다. 관리자 화면에서 더한 문구는 관리자 화면에서 지시문에
  `{{shared.키}}`로 넣는다.
- **시험**: 관리자 AI 화면의 기능 오른쪽 아래에서 저장 전에 실행해 본다. 칸은 기능의 입력 종류로 만든다(글·MDX·코드는
  여러 줄 칸, 현재 값은 한 줄 칸, 이미지는 미디어 ID 또는 사이트 경로, 언어는 사이트 설정의 언어 고르기). 보낼 입력과
  필수 입력, 언어 입력만 보이고, 필수 칸이 비면 실행하지 않는다.
- **번역 기능 여럿**: 붙을 곳이 `translation`인 기능이 여럿이면 블록 손잡이 옆에 기능마다 버튼(기능 이름)이 붙고,
  `모두 번역`에서 쓸 기능을 고른다.
- **화면 기능**: 관리자 AI 화면의 "기능 추가"로 코드 없이 기능을 만든다. 오른쪽 칸에서 이름·붙을 곳(필드 옆·선택 영역
  메뉴·넣기 메뉴·본문 블록·본문 이미지·미디어)·결과 모양·방식과 연결·지시문·보낼 내용·검사를 함께 고치고, 저장 전에
  시험한 뒤 한 번에 저장한다. 관계·선택 필드(태그·카테고리 등)는 판단 방식(System One)도 고른다. DB(`ai_custom_actions`)에 둔다.
  관계·선택 필드 기능의 처음 기준값은 `CUSTOM_PICK_DEFAULTS`(여러 개: 0.6·5개, 하나: 0.3·2개)다.

## 블록에 붙는 기능

`attach: [{ slot: "block", block: "블록 이름" }]`이면 그 블록의 손잡이 옆에 버튼이 생긴다. 블록 원문(MDX, 예: ` ```mermaid … ``` `)을
`block` 입력으로 보내고, 결과(MDX)가 같은 종류의 블록 하나면 바뀐 곳을 보인 뒤 그 블록을 바꾼다. 블록 이름은 사이트가 쓰는
블록이어야 한다(설정을 만들 때 확인한다). 블록 확장이나 사이트 블록 모두 같은 방법으로 붙는다.

블록 확장의 Mermaid·차트 기능(만들기: 슬래시 메뉴, 고치기: 블록 손잡이 옆)은 그 블록 플러그인이 더하므로 적지 않는다.
사이트 블록에는 직접 붙인다.

```ts
aiPlugin({
	actions: {
		graphvizEdit: aiAction({
			label: "그래프 고치기",
			input: { block: aiInput.mdx({ label: "그래프", required: true }) },
			prompt: "```graphviz 코드 펜스를 요청대로 고친다. 답은 고친 펜스 하나만 쓴다.",
			result: "mdx",
			stream: true,
			askInstruction: true,
			attach: [{ slot: "block", block: "graphviz" }],
		}),
	},
});
```

흘려받은 MDX 결과는 답 전체를 감싼 ` ```mdx ` 펜스만 벗긴다. 블록 원문인 다른 언어의 펜스는 그대로 둔다.

## 진입점

| 진입점 | 내용 |
| --- | --- |
| `@monti-cms/ai` | `aiPlugin`, `aiAction`, `aiInput`, `aiPresets`, `resolveAiActions`, 기여 타입(`AiContribution`·`AiActionFactory`·`AiSiteView`) (사이트 설정용, 서버·브라우저 공용) |
| `@monti-cms/ai/server` | 서버 쪽(API 경로·표 만들기). 본체가 불러 쓴다. 브라우저 묶음에서는 빈 진입점이다 |
| `@monti-cms/ai/admin` | 관리자 쪽(AI 화면·공급자), `useAiAction`, `AiButton` |

## 개발

```bash
pnpm --filter @monti-cms/ai test:run        # 예시 블로그 설정 + 다른 사이트 설정
pnpm --filter @monti-cms/ai test:other-site # 다른 사이트 설정(`test/other-site.config.ts`)만
```

다른 사이트 설정은 AI 필드 기능을 그 사이트의 필드 이름(`excerpt`·`topicIds`·`authorId`·`metaTitle`…)에 붙인다. 설정과 상관없는
확인은 `src/__test__/any-site.test.ts`다(필드 기능이 맞는 종류의 필드에 붙는지, 자리 입력으로 실행되는지).
