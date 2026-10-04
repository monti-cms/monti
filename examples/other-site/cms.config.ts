import { blocks } from "@monti-cms/blocks";
import { defineBlock, defineCollection, defineConfig, fields } from "@monti-cms/core";
import { seo, seoFields } from "@monti-cms/seo";

/**
 * 블로그와 일부러 다르게 만든 예시 사이트. 컬렉션은 글(article)·주제(topic)·글쓴이(author), 언어는 영어 하나다.
 * 라이브러리 약속인 제목 필드 `title`과 주소 필드 `slug`만 블로그와 같고, 나머지 필드 이름·이름표는 사이트가 정한다.
 * 블록 확장에서는 차트만 설치하고 사이트 블록 둘(인용 카드·지도)을 더한다.
 * 패키지 테스트의 다른 사이트 설정(`packages/core/test/other-site.config.ts`)과 모양이 같다.
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
	// 주소 규칙도 블로그와 다르게: 모든 언어에 접두사(`/en/blog/...`), 미리보기 언어는 경로로.
	site: { name: "Example site", previewPath: "/preview", localePrefix: "always", previewLocaleParam: false },
	// 관리자 화면 경로(`monti init --admin-path /studio`). 라우트 폴더 `app/(admin)/studio/`와 같다.
	admin: { path: "/studio" },
	timeZone: "UTC",
	// 블록 확장에서 차트만 설치하고(`blocks({ only })`), 사이트 블록 둘을 더한다. SEO 확장은 검색 미리보기·숨기기 스위치를 준다.
	// 차트 편집기 미리보기는 선택 의존성 `recharts`로 그린다.
	plugins: [...blocks({ only: ["chart"] }), seo()],
	blocks: [quoteCard, mapBlock],
});
