import { ALL_BLOCKS } from "../../blocks/src/definitions";
import { seoFields } from "../../seo/src/fields";
import { defineBlock, defineCollection, defineConfig, fields } from "../src";

/**
 * 패키지 자체 테스트가 쓰는 예시 사이트 설정. 한 블로그의 실제 설정과 같은 모양이다.
 * 패키지 코드는 아직 이 컬렉션 이름(post·memo·category·tag·collection)을 직접 아는 곳이 있어 모양을 맞춘다.
 */

const title = fields.text({
	label: "제목",
	required: true,
	max: 200,
	placeholder: "제목 없는 글",
	localized: true,
});
const slug = fields.slug({
	label: "주소",
	from: "title",
	required: true,
	placeholder: "url-friendly-slug",
	localized: "inherit",
});
const contentSlug = {
	...slug,
	description: "발행된 글의 주소를 바꾸면 이전 주소는 308 리다이렉트로 새 주소를 안내합니다.",
} as const;
const tagIds = fields.relation({
	label: "태그",
	to: "tag",
	many: true,
	createInline: true,
	description: "고른 순서를 보존합니다.",
});

/**
 * 검색엔진·공유용 값(SEO 확장 `seoFields`). 블로그와 같은 필드 이름이고 모두 SEO 탭에 모인다(필드 `tab`).
 * 테스트는 플러그인(`seo()`) 없이 필드만 쓴다(관리자 화면 코드를 읽지 않는다).
 */
const seo = seoFields({
	keys: {
		preview: "searchPreview",
		title: "seoTitle",
		description: "seoDescription",
		image: "ogImageId",
		noindex: "seoRobots",
		canonical: "canonicalUrl",
	},
});

export const post = defineCollection({
	label: "게시글",
	icon: "file-text",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title,
		slug: contentSlug,
		summary: fields.text({
			label: "요약",
			multiline: true,
			placeholder: "목록과 검색 결과에 보일 소개글",
			role: "summary",
			rows: 3,
			fillFromBody: true,
			localized: true,
		}),
		categoryId: fields.relation({ label: "카테고리", to: "category", required: true, createInline: true }),
		tagIds,
		series: fields.backlink({
			label: "모음집",
			from: "collection",
			via: "itemIds",
			createInline: true,
			description: "누르는 즉시 모음집에 저장됩니다(글의 초안·발행과 별개). 추가하면 모음집 끝에 들어갑니다.",
			placeholder: "모음집에 추가",
		}),
		policy: fields.conditional(
			fields.select({
				label: "정책",
				description: "지원 중단 글은 공개 화면에서 대체 글을 안내합니다.",
				options: { normal: "일반", evergreen: "항상 최신 글", deprecated: "지원 중단" },
				defaultValue: "normal",
			}),
			{
				/** 독자를 안내할 최신 글(v1 §6.4 "대체 글 관계"). */
				deprecated: {
					replacementPostId: fields.relation({
						label: "대체 글",
						to: "post",
						publishedOnly: true,
						placeholder: "공개된 글 고르기",
					}),
				},
			},
		),
		...seo,
	},
	layout: [
		{ fields: ["title", "slug", "summary"] },
		{ group: "분류", fields: ["categoryId", "tagIds", "series"] },
		{ group: "정책", fields: ["policy"] },
	],
});

export const memo = defineCollection({
	label: "메모",
	icon: "notebook-pen",
	kind: "document",
	path: "/memos/:slug",
	fields: {
		title,
		slug: contentSlug,
		tagIds,
		series: fields.backlink({
			label: "모음집",
			from: "collection",
			via: "memoIds",
			createInline: true,
			description:
				"누르는 즉시 모음집에 저장됩니다(메모의 초안·발행과 별개). 메모를 담는 모음집만 고를 수 있고, 추가하면 끝에 들어갑니다.",
			placeholder: "모음집에 추가",
		}),
		...seo,
	},
	layout: [{ fields: ["title", "slug"] }, { group: "분류", fields: ["tagIds", "series"] }],
});

/** 이름만 언어별 값이고 주소와 연결 관계는 공통이다(v2 B4). */
const taxonomyFields = {
	title: fields.text({ label: "이름", required: true, max: 200, localized: true }),
	slug: fields.slug({ label: "주소", from: "title", required: true }),
} as const;

export const category = defineCollection({
	label: "카테고리",
	icon: "shapes",
	kind: "item",
	fields: taxonomyFields,
});

export const tag = defineCollection({
	label: "태그",
	icon: "tag",
	kind: "item",
	fields: taxonomyFields,
});

export const series = defineCollection({
	label: "모음집",
	icon: "layers",
	kind: "item",
	fields: {
		...taxonomyFields,
		summary: fields.text({ label: "설명", role: "summary", multiline: true, localized: true }),
		/**
		 * 모음집은 게시글 또는 메모 한 종류를 순서대로 담는다. 게시글 목록은 예전 키(`itemIds`)를 그대로 쓴다.
		 * 종류를 바꿔 저장하면 다른 종류 목록은 비워진다.
		 */
		itemKind: fields.conditional(
			fields.select({
				label: "담는 글",
				options: { post: "게시글", memo: "메모" },
				defaultValue: "post",
				description: "종류를 바꿔 저장하면 담아 둔 다른 종류 목록은 비워집니다.",
			}),
			{
				post: {
					itemIds: fields.relation({
						label: "게시글",
						to: "post",
						many: true,
						ordered: true,
						allowUnpublished: true,
						description: "아직 공개되지 않은 글도 담을 수 있고 공개 목록에서만 빠집니다.",
						placeholder: "글 추가·빼기",
					}),
				},
				memo: {
					memoIds: fields.relation({
						label: "메모",
						to: "memo",
						many: true,
						ordered: true,
						allowUnpublished: true,
						description: "아직 공개되지 않은 메모도 담을 수 있고 공개 목록에서만 빠집니다.",
						placeholder: "메모 추가·빼기",
					}),
				},
			},
		),
	},
});

/** 사용자 블록 예시(블로그에는 없다). 편집기 노드가 있는 컨테이너와 원문 상자로 보이는 한 줄 블록이다. */
const notice = defineBlock({
	name: "notice",
	label: "공지",
	syntax: { kind: "container", directive: "notice" },
	component: "Notice",
	attributes: {
		level: { type: "string", label: "단계", options: { info: "안내", warn: "주의" }, defaultValue: "info" },
		title: { type: "string", label: "제목", translatable: true },
	},
	editor: { view: "node", insertable: true, keywords: ["notice", "공지"] },
});

const embed = defineBlock({
	name: "embed",
	label: "임베드",
	syntax: { kind: "leaf", directive: "embed" },
	component: "Embed",
	attributes: { url: { type: "string", label: "주소", required: true } },
	editor: { view: "opaque" },
});

export default defineConfig({
	collections: { post, memo, category, tag, collection: series },
	locales: [
		{ code: "ko", name: "한국어", label: "한국어" },
		{ code: "en", name: "English", label: "영어" },
		{ code: "ja", name: "日本語", label: "일본어" },
	],
	defaultLocale: "ko",
	site: { url: "https://example.dev", aliases: ["www.example.dev"], name: "example.dev", previewPath: "/preview" },
	timeZone: "Asia/Seoul",
	// 블록 확장(`@monti-cms/blocks`)의 블록 + 사용자 블록. 테스트는 플러그인 없이 정의만 쓴다(관리자 화면 코드를 읽지 않는다).
	blocks: [...ALL_BLOCKS, notice, embed],
	seed: {
		templates: [
			{
				id: "00000000-0000-4000-8000-000000000001",
				name: "알고리즘 풀이",
				mdx: "## 문제\n\n\n## 풀이\n\n```ts\n\n```\n",
			},
			{
				id: "00000000-0000-4000-8000-000000000002",
				name: "Type Challenge 풀이",
				mdx: "### 질문\n\n\n```ts\n\n```\n\n### 풀이\n\n",
			},
			{
				id: "00000000-0000-4000-8000-000000000003",
				name: "일반 게시글",
				mdx: "## 개요\n\n글의 핵심을 소개합니다.\n\n## 본문\n\n\n## 정리\n\n마무리 내용을 작성합니다.\n",
			},
		],
	},
});
