# @monti-cms/seo

[English](README.md) | 한국어

`@monti-cms/core`의 SEO 확장. 검색엔진·공유용 필드 묶음과 편집 화면의 검색 결과·공유 미리보기, 검색 제목·설명 글자 수,
검색엔진 숨기기 스위치를 더한다. `@monti-cms/ai`가 있으면 검색 제목·설명 추천도 붙는다. 공개 화면은 `seoOf`로 값을 읽는다.

## 등록

설정에 플러그인을 더한다. 필드는 `monti.schema.ts`의 평범한 필드이고 역할로 찾으므로, 스키마 파일은 설정 화면이 고칠 수 있는 평범한 데이터로 남는다.

```ts
// monti.config.ts
import { seo } from "@monti-cms/seo";

export const cms = defineConfig({
	schema,
	// …
	plugins: [seo()],
});
```

설정 화면에서 컬렉션의 **필드** 탭을 열고 **SEO 필드 추가**를 고른다. `seo()` 플러그인이 켜져 있고 컬렉션에 SEO 역할 필드가 아직 없을 때 나오는 동작이며, 아래 필드를 평소의 초안·검토 단계로 `monti.schema.ts`에 쓴다(이미 쓰인 이름에는 숫자가 붙는다). 같은 필드를 손으로 적어도 된다.

```ts
// monti.schema.ts
fields: {
	title: { kind: "text", label: "제목" },
	summary: { kind: "text", label: "요약", role: "summary" },
	searchPreview: { kind: "view", view: "search" },
	seoTitle: { kind: "text", label: "검색 제목", localized: true, role: "seoTitle", input: "seo-title", inputOptions: { limit: 60 } },
	seoDescription: { kind: "text", label: "검색 설명", localized: true, multiline: true, role: "seoDescription", input: "seo-description", inputOptions: { limit: 155 } },
	ogImageId: { kind: "media", label: "공유 이미지", localized: true, role: "ogImage", accept: "image" },
	seoRobots: { kind: "select", label: "검색엔진에서 숨기기", role: "noindex", input: "seo-noindex", options: { index: "보임", noindex: "숨김" }, defaultValue: "index" },
	canonicalUrl: { kind: "text", label: "원문 주소", localized: true, role: "canonical", placeholder: "https://" },
},
```

플러그인은 `layout`에 적지 않아도 이 필드들을 자기 탭에 둔다. SEO 패널은 자기 스타일시트가 필요 없다. `@monti-cms/admin/styles.css`가 이미 담고 있다(앱에 Tailwind가 필요 없다).

## 필드 묶음 `seoFields(options?)` (코드로 쓴 컬렉션)

코드로 정의한 컬렉션(`monti.config.ts`의 `defineCollection`)은 같은 필드를 `seoFields()`로 펼칠 수 있다. 거기서 함수를 부르면 스키마가 평범한 리터럴이 아니게 되어 설정 화면에서 읽기 전용으로 보인다. 컬렉션을 코드에 두어야 할 이유가 없으면 스키마 파일을 쓰는 편이 낫다.

```ts
const article = defineCollection({
	label: "Article",
	kind: "document",
	fields: { title, slug, ...seoFields() },
});
```

| 자리 | 기본 이름 | 필드 | 역할(`role`) | 편집 화면 |
| --- | --- | --- | --- | --- |
| `preview` | `seoPreview` | 보기 필드 `search` | - | 검색 결과·공유 미리보기. 비운 제목·설명은 제목·요약 역할 값 |
| `title` | `seoTitle` | 텍스트 | `seoTitle` | 비우면 제목을 안내 문구로, 글자 수(권장 60) |
| `description` | `seoDescription` | 여러 줄 텍스트 | `seoDescription` | 비우면 요약을 안내 문구로, 글자 수(권장 155) |
| `image` | `seoImage` | 미디어(`fields.media`, 이미지) | `ogImage` | 미디어 고르기. 쓰고 있는 이미지는 지울 수 없다 |
| `noindex` | `seoNoindex` | 선택(`index`·`noindex`) | `noindex` | 이름표 줄의 스위치. 켜면 `noindex` |
| `canonical` | `seoCanonical` | 텍스트 | `canonical` | 원본 주소 |

`seo()` 플러그인이 역할과 미리보기 보기 이름으로 이 필드들을 찾아 편집 화면의 제 탭(기본 `SEO`, `seo({ tab })`로 바꿈)에 둔다. 배치(`layout`)를 적지 않아도 된다. 값은 필드 이름이 아니라 역할로
찾으므로 이름은 사이트가 정한다.

```ts
seoFields({
	keys: { title: "metaTitle", image: "ogImageId" }, // 필드 이름(이미 저장한 값의 이름 그대로 쓰기)
	labels: { title: "Search title" }, // 이름표
	localized: false, // 제목·설명·이미지·원본 주소를 언어마다 따로 둘까(기본 true, 숨기기는 언제나 공통)
	limits: { title: 70, description: 160 }, // 권장 글자 수: 넘으면 글자 수 색이 바뀌고 AI 추천 길이가 된다(저장은 막지 않는다)
	omit: ["canonical"], // 빼는 자리
});
```

권장 글자 수는 필드의 `inputOptions.limit`에 담긴다. 저장을 막는 한도가 필요하면 필드 `max`를 쓰는 별도 필드를 둔다.

## 플러그인 `seo(options?)`

- **관리자 화면**(`@monti-cms/seo/admin`): 보기 필드 `search`, 입력 조각 `seo-title`·`seo-description`(안내 문구·글자 수),
  `seo-noindex`(스위치)를 `AdminComponentsProvider`로 등록한다. 등록이 없으면(확장을 빼면) 같은 필드가 기본 입력으로 보인다.
- **설정 검사**: `seoTitle`·`seoDescription`·`canonical`은 텍스트, `ogImage`는 미디어, `noindex`는 `noindex` 선택지가 있는 선택
  필드여야 한다(`checkSeoFields`).
- **AI 기능**: `@monti-cms/ai`가 있으면 `seoTitle`(검색 제목 추천, 후보 3개)·`seoDescription`(검색 설명 추천)을 더한다
  (`contributes.ai`). 역할 필드가 있는 모든 컬렉션에 붙고, 길이는 필드 `max` → 권장 글자 수 → 60·155다. 바꾸려면
  `ai({ actions: { seoTitle: seoAi.title({ prompt }) } })`, 끄려면 `seoTitle: false` 또는 `seo({ ai: false })`.

## 공개 화면 `seoOf(collection, metadata)`

```ts
import { seoOf } from "@monti-cms/seo";
import { post } from "@/monti.config";

const { title, description, imageId, canonical, noindex } = seoOf(post, entry.metadata);
```

컬렉션 정의(`defineCollection`의 결과)와 저장된 메타데이터에서 역할로 값을 읽는다. 비운 제목·설명은 제목(`title`)·요약
(`role: "summary"`)으로 채우고, 비운 값은 없다(`undefined`). 공유 이미지는 미디어 ID라 공개 주소는 사이트가 만든다
(`cms.read.mediaUrl(id)`, 앱의 `monti.config.ts`가 내보내는 `cms` 인스턴스).

## 진입점

| 진입점 | 내용 |
| --- | --- |
| `@monti-cms/seo` | `seo`, `seoFields`, `seoOf`, `seoAi`, `SEO_ROLES`, `checkSeoFields` (사이트 설정·공개 화면, 서버·브라우저 공용) |
| `@monti-cms/seo/admin` | 관리자 쪽 공급자(본체가 플러그인 정의의 `admin`으로 불러 쓴다) |

## 개발

```sh
pnpm --filter @monti-cms/seo test:run     # 예시 블로그 설정 + 다른 사이트 설정
pnpm --filter @monti-cms/seo typecheck
```
