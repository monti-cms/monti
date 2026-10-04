import { chartBlock } from "../../blocks/src/definitions";
import { seoFields } from "../../seo/src/fields";
import { defineBlock, defineCollection, defineConfig, fields } from "../src";

/**
 * 재발 방지용 다른 사이트 설정(M10-1). 예시 블로그 설정(`cms.config.ts`)과 일부러 다르게 만든다.
 * - 컬렉션: article·topic·author(블로그의 post·memo·category·tag·collection이 없다)
 * - 필드: 라이브러리 약속인 `title`과 주소 필드 `slug`만 같고 나머지 이름(`excerpt`·`topicIds`·`authorId`·`heroImage`·
 *   `metaTitle`…)과 이름표는 모두 다르다. 제목 글자 수 한도도 블로그(200)와 다르다(120). SEO 필드도 다른 이름·탭이다.
 * - 언어: 영어 하나. 블록: 블록 확장의 차트만 + 사이트 블록(인용 카드·코드 펜스 지도).
 *
 * 본체·관리자·AI 테스트 일부가 이 설정으로도 돈다(각 패키지의 `vitest.othersite.config.ts`). 타입 검사도 한다
 * (`tsconfig.other-site.json`). 예시 앱 `examples/other-site/cms.config.ts`와 모양을 맞춘다.
 */

const article = defineCollection({
	label: "Article",
	icon: "newspaper",
	kind: "document",
	path: "/blog/:slug/",
	fields: {
		title: fields.text({ label: "Headline", required: true, max: 120 }),
		slug: fields.slug({ label: "Permalink", from: "title", required: true }),
		// 요약·검색 값은 이름이 아니라 역할(`role`)로 찾는다. 블로그와 다른 이름을 쓴다.
		excerpt: fields.text({ label: "Excerpt", role: "summary", multiline: true, fillFromBody: true, max: 300 }),
		authorId: fields.relation({ label: "Author", to: "author", required: true }),
		topicIds: fields.relation({ label: "Topics", to: "topic", many: true, createInline: true }),
		heroImage: fields.text({ label: "Hero image", placeholder: "https://" }),
		format: fields.select({
			label: "Format",
			options: { news: "News", guide: "Guide", review: "Review" },
			defaultValue: "news",
		}),
		// SEO 확장의 필드 묶음. 블로그와 다른 이름·이름표·탭(`Search`)이고 원본 주소는 뺀다. 묶음의 필드는 제 `tab`으로 그 탭에 모인다.
		...seoFields({
			keys: {
				preview: "searchPreview",
				title: "metaTitle",
				description: "metaDescription",
				image: "shareImage",
				noindex: "hideFromSearch",
			},
			labels: {
				title: "Search title",
				description: "Search description",
				image: "Share image",
				noindex: "Hide from search",
			},
			omit: ["canonical"],
			tab: "Search",
			localized: false,
			limits: { title: 70 },
		}),
	},
	layout: [
		{ fields: ["title", "slug", "excerpt", "authorId", "topicIds"] },
		{ group: "Presentation", fields: ["heroImage", "format"] },
	],
	list: { columns: ["title", "status", "authorId", "topicIds", "format", "updatedAt"] },
});

const topic = defineCollection({
	label: "Topic",
	icon: "tag",
	kind: "item",
	fields: {
		title: fields.text({ label: "Name", required: true, max: 60 }),
		slug: fields.slug({ label: "Key", from: "title", required: true }),
	},
	list: { columns: ["title", "slug", "updatedAt"] },
});

const author = defineCollection({
	label: "Author",
	icon: "user",
	kind: "item",
	fields: {
		title: fields.text({ label: "Display name", required: true }),
		slug: fields.slug({ label: "Handle", from: "title", required: true }),
		bio: fields.text({ label: "Bio", multiline: true }),
	},
	list: { columns: ["title", "slug"] },
});

/** 사이트 블록: 인용 카드(컨테이너). 공개 화면은 사이트의 `QuoteCard` 컴포넌트가 그린다. */
const quoteCard = defineBlock({
	name: "quote-card",
	label: "Quote card",
	syntax: { kind: "container", directive: "quote-card" },
	component: "QuoteCard",
	attributes: { author: { type: "string", label: "Author", translatable: true } },
	editor: { view: "node", insertable: true, keywords: ["quote", "card"] },
});

/** 사이트 블록: 지도(코드 펜스). 펜스 안 글을 그대로 저장한다. */
const mapBlock = defineBlock({
	name: "map",
	label: "Map",
	syntax: { kind: "fence", lang: "map" },
	component: "MapEmbed",
	attributes: {},
	editor: { view: "node", insertable: true, keywords: ["map"], insert: { code: "lat 37.5\nlng 127.0" } },
});

export default defineConfig({
	collections: { article, topic, author },
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
	site: {
		url: "https://example.org",
		name: "Example site",
		previewPath: "/preview",
		// 블로그와 다른 주소 규칙(M10-4): 모든 언어에 접두사, 미리보기 언어는 경로로, 사이트 보기는 다른 호스트.
		localePrefix: "always",
		previewLocaleParam: false,
		home: "https://example.org/",
	},
	// 관리자 화면 경로도 블로그(`/admin`)와 다르게 둔다.
	admin: { path: "/studio" },
	timeZone: "UTC",
	blocks: [chartBlock, quoteCard, mapBlock],
});
