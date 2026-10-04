import {
	createActiveTranslator,
	fields,
	type MediaField,
	type SelectField,
	type TextField,
	type ViewField,
} from "@monti-cms/core";
import { seoMessages } from "./messages";

/**
 * SEO 필드 묶음(`seoFields`). 컬렉션 `fields`에 펼쳐 넣는다. 값은 필드 이름이 아니라 역할(`SEO_ROLES`)로 찾으므로 필드 이름·
 * 이름표는 사이트가 정한다. 모든 필드는 `tab`(기본 `SEO`)을 가져 배치(`layout`)를 적지 않아도 편집 화면의 그 탭에 모인다.
 *
 * ```ts
 * fields: { title, slug, ...seoFields() }
 * ```
 */

/** 묶음의 필드 자리. */
export type SeoPart = "preview" | "title" | "description" | "image" | "noindex" | "canonical";

/** 자리마다의 필드 역할. 공개 화면 도우미(`seoOf`)·검색 미리보기·AI 기능이 이 역할로 값을 찾는다. */
export const SEO_ROLES = {
	title: "seoTitle",
	description: "seoDescription",
	image: "ogImage",
	noindex: "noindex",
	canonical: "canonical",
} as const;

/** 기본 필드 이름. */
export const SEO_DEFAULT_KEYS = {
	preview: "seoPreview",
	title: "seoTitle",
	description: "seoDescription",
	image: "seoImage",
	noindex: "seoNoindex",
	canonical: "seoCanonical",
} as const;

// 설정 파일이 이 모듈을 불러오는 때에는 화면 언어를 아직 모르므로, 기본 이름표는 글자를 읽는 때에 고른다.
const t = createActiveTranslator(seoMessages);

/** 기본 이름표(화면 언어를 따른다). */
export const SEO_DEFAULT_LABELS = {
	get title() {
		return t("field.title");
	},
	get description() {
		return t("field.description");
	},
	get image() {
		return t("field.image");
	},
	get noindex() {
		return t("field.noindex");
	},
	get canonical() {
		return t("field.canonical");
	},
} as const;

/** 검색 결과에서 잘리지 않는 대략의 길이(Strapi·Yoast 등이 쓰는 기준). 글자 수 표시와 AI 추천 길이에 쓴다. */
export const SEO_DEFAULT_LIMITS = { title: 60, description: 155 } as const;

/** 관리자 화면 입력 이름(SEO 확장의 관리자 쪽이 등록한다). 등록되지 않으면 기본 입력으로 그린다. */
export const SEO_INPUTS = { title: "seo-title", description: "seo-description", noindex: "seo-noindex" } as const;
/** 검색 결과·공유 미리보기 보기 필드 이름. */
export const SEO_PREVIEW_VIEW = "search";

export interface SeoFieldsOptions<
	K extends Partial<Record<SeoPart, string>> = Partial<Record<SeoPart, string>>,
	O extends SeoPart = SeoPart,
> {
	/** 필드 이름 바꾸기. 이미 저장한 값이 있는 이름은 그대로 둔다. */
	readonly keys?: K;
	/** 빼는 자리(예: `["canonical"]`). */
	readonly omit?: readonly O[];
	/** 이름표 바꾸기. */
	readonly labels?: Partial<Record<Exclude<SeoPart, "preview">, string>> & { readonly preview?: string };
	/** 편집 화면 탭 이름. 기본 `SEO`. */
	readonly tab?: string;
	/** 제목·설명·이미지·원본 주소를 언어마다 따로 둔다. 기본 `true`(숨기기는 언제나 공통 값이다). */
	readonly localized?: boolean;
	/** 권장 글자 수(넘으면 글자 수 색이 바뀐다, 저장은 막지 않는다). AI 추천 길이에도 쓴다. */
	readonly limits?: { readonly title?: number; readonly description?: number };
}

type KeyOf<K, P extends SeoPart> = K extends { readonly [Q in P]: infer N extends string }
	? N
	: (typeof SEO_DEFAULT_KEYS)[P];

/** 자리마다의 필드 정의 모양(저장 값 타입을 정한다). */
interface SeoPartFields {
	readonly preview: ViewField;
	readonly title: TextField;
	readonly description: TextField;
	readonly image: MediaField;
	readonly noindex: SelectField<"index" | "noindex">;
	readonly canonical: TextField;
}

/** `seoFields`가 돌려주는 필드(필드 이름 → 정의). */
export type SeoFields<K, O extends SeoPart = never> = {
	readonly [P in Exclude<SeoPart, O> as KeyOf<K, P>]: SeoPartFields[P];
};

/** SEO 필드 묶음을 만든다. */
export function seoFields<
	const K extends Partial<Record<SeoPart, string>> = Record<never, never>,
	const O extends SeoPart = never,
>(options: SeoFieldsOptions<K, O> = {}): SeoFields<K, O> {
	const key = (part: SeoPart) => options.keys?.[part] ?? SEO_DEFAULT_KEYS[part];
	const custom = (part: Exclude<SeoPart, "preview">) => options.labels?.[part];
	/** 사이트가 이름표를 정하지 않았으면 읽는 때에 화면 언어로 고른다(필드를 만드는 때에는 언어를 아직 모른다). */
	const lazyLabel = <F extends { label: string }>(field: F, part: Exclude<SeoPart, "preview">): F =>
		custom(part) === undefined
			? Object.defineProperty(field, "label", {
					get: () => SEO_DEFAULT_LABELS[part],
					enumerable: true,
					configurable: true,
				})
			: field;
	const tab = options.tab ?? "SEO";
	const localized = options.localized ?? true;
	const limits = { ...SEO_DEFAULT_LIMITS, ...options.limits };
	const shared = { tab, ...(localized ? { localized: true as const } : {}) };
	const result: Record<string, unknown> = {
		/** 검색 결과·공유 미리보기. 값은 역할 필드에서 읽고 비면 제목·요약을 쓴다. */
		[key("preview")]: fields.view({
			view: SEO_PREVIEW_VIEW,
			tab,
			...(options.labels?.preview ? { label: options.labels.preview } : {}),
		}),
		/** 검색 결과 제목. 비우면 제목을 쓴다. */
		[key("title")]: lazyLabel(
			fields.text({
				label: custom("title") ?? "",
				role: SEO_ROLES.title,
				input: SEO_INPUTS.title,
				inputOptions: { limit: limits.title },
				...shared,
			}),
			"title",
		),
		/** 검색 결과 설명. 비우면 요약을 쓴다. */
		[key("description")]: lazyLabel(
			fields.text({
				label: custom("description") ?? "",
				role: SEO_ROLES.description,
				multiline: true,
				input: SEO_INPUTS.description,
				inputOptions: { limit: limits.description },
				...shared,
			}),
			"description",
		),
		/** 링크 미리보기·검색 결과 이미지. 비우면 사이트가 정한 기본 이미지를 쓴다. */
		[key("image")]: lazyLabel(
			fields.media({ label: custom("image") ?? "", role: SEO_ROLES.image, accept: "image", ...shared }),
			"image",
		),
		/** `noindex`면 검색엔진에 숨긴다. */
		[key("noindex")]: lazyLabel(
			fields.select({
				label: custom("noindex") ?? "",
				role: SEO_ROLES.noindex,
				options: {
					get index() {
						return t("option.index");
					},
					get noindex() {
						return t("option.noindex");
					},
				},
				defaultValue: "index",
				input: SEO_INPUTS.noindex,
				tab,
			}),
			"noindex",
		),
		/** 다른 곳에 먼저 올린 글의 주소(canonical). */
		[key("canonical")]: lazyLabel(
			fields.text({
				label: custom("canonical") ?? "",
				role: SEO_ROLES.canonical,
				placeholder: "https://",
				...shared,
			}),
			"canonical",
		),
	};
	for (const part of options.omit ?? []) delete result[key(part)];
	return result as unknown as SeoFields<K, O>;
}
