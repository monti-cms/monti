import { type CollectionSchema, type StoredField, SUMMARY_ROLE, valueFieldsOf } from "@monti-cms/core";
import { type AiAttach, type AiSiteView, aiAction, aiInput } from "./action";
import { lazyTranslator } from "./i18n";
import { presetMessages } from "./presets.messages";
import { regexRuns, sameStructure, uniqueSlug } from "./validators";

/**
 * 기본 AI 기능(프리셋). `aiPlugin()`을 넣으면 사이트에 붙을 곳이 있는 기본 기능이 저절로 켜진다. 바꿀 것만
 * `aiPlugin({ actions })`에 같은 이름으로 적는다(`false`면 끈다).
 *
 * ```ts
 * aiPlugin({ actions: { summary: aiPresets.summary({ maxLength: 120 }), draft: false } })
 * ```
 *
 * 필드 기능은 필드 이름이 아니라 필드 종류·역할·관계 대상으로 붙을 필드를 찾는다. 본문을 읽는 기능이라 본문이 있는
 * 컬렉션에만 붙는다. 지시문은 관리자 AI 화면에서 고칠 수 있고, 프리셋 옵션 `prompt`로 처음 값을 바꿀 수도 있다.
 */

const t = lazyTranslator(presetMessages);

/** 필드 옆 자리가 주는 재료. 필드 기능은 이 입력을 모두 받을 수 있고, 무엇을 보낼지는 `send`로 고른다. */
const fieldInput = () => ({
	title: aiInput.text({ label: t("input.title") }),
	summary: aiInput.text({ label: t("input.summary") }),
	body: aiInput.mdx({ label: t("input.body") }),
	current: aiInput.value({ label: t("input.current") }),
});

/** 이미지 기능(대체 텍스트·캡션)이 받는 재료. */
const imageInput = () => ({
	image: aiInput.image({ label: t("input.image") }),
	around: aiInput.text({ label: t("input.around") }),
	current: aiInput.value({ label: t("input.current") }),
});

type FieldOptions = {
	/** 붙일 필드 이름. 없으면 필드 종류·역할·관계 대상으로 찾는다. */
	readonly field?: string;
	/** 붙일 컬렉션. 없으면 본문이 있는 모든 컬렉션 중 붙을 필드가 있는 것. */
	readonly collections?: readonly string[];
	readonly prompt?: string;
};

/** 붙을 필드 하나. */
export interface AiFieldTarget {
	readonly collection: string;
	readonly name: string;
	readonly label: string;
	readonly max?: number;
}

/** 필드 기능이 볼 컬렉션: 옵션의 `collections`, 없으면 본문이 있는 컬렉션. */
const candidateCollections = (site: AiSiteView, options: FieldOptions): [string, CollectionSchema][] =>
	Object.entries(site.collections).filter(([name, schema]) =>
		options.collections ? options.collections.includes(name) : schema.body,
	);

/**
 * 컬렉션마다 붙을 필드를 찾는다. `field`를 주면 그 이름의 필드를, 아니면 `pick`이 고른 필드다. 컬렉션마다 하나다.
 */
export function fieldTargets(
	site: AiSiteView,
	options: FieldOptions,
	pick: (
		schema: CollectionSchema,
	) => { readonly name: string; readonly field: { readonly label?: string } } | undefined,
): AiFieldTarget[] {
	return candidateCollections(site, options).flatMap(([collection, schema]) => {
		const found = options.field
			? (valueFieldsOf(schema).find((stored) => stored.name === options.field) ??
				(schema.fields[options.field] ? { name: options.field, field: schema.fields[options.field] } : undefined))
			: pick(schema);
		if (!found) return [];
		const max = "max" in found.field && typeof found.field.max === "number" ? found.field.max : undefined;
		return [{ collection, name: found.name, label: found.field.label ?? found.name, ...(max ? { max } : {}) }];
	});
}

/** 붙을 곳. 필드 이름마다 하나이고 그 이름이 있는 컬렉션을 적는다. */
export function fieldAttachOf(targets: readonly AiFieldTarget[]): Extract<AiAttach, { slot: "field" }>[] {
	const byName = new Map<string, string[]>();
	for (const { name, collection } of targets) byName.set(name, [...(byName.get(name) ?? []), collection]);
	return [...byName].map(([field, collections]) => ({ slot: "field", field, collections }));
}

/** 붙을 필드들의 가장 작은 `max`. 없으면 `undefined`. */
export const smallestMax = (targets: readonly AiFieldTarget[]): number | undefined => {
	const maxes = targets.flatMap((target) => (target.max === undefined ? [] : [target.max]));
	return maxes.length > 0 ? Math.min(...maxes) : undefined;
};

/** 레코드(분류) 컬렉션을 가리키는 관계 필드. `many`로 여러 개·하나를 고른다. */
const recordRelation =
	(site: AiSiteView, many: boolean, to?: string) =>
	(schema: CollectionSchema): StoredField | undefined =>
		valueFieldsOf(schema).find(
			({ field }) =>
				field.kind === "relation" &&
				Boolean(field.many) === many &&
				(to ? field.to === to : site.collections[field.to]?.kind === "item"),
		);

const lines = (...text: string[]) => text.join("\n");

/** 주소·파일 이름처럼 소문자·숫자·하이픈만 쓰는 값의 형식. 주소·파일 이름 프리셋의 `형식` 검사에 채워 둔다. */
export const KEBAB_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

/** 앞뒤 문단이 없을 때 쓰는 언어. 실행기가 지시에 "Content language"(글의 언어, 없으면 사이트 기본 언어)를 붙인다. */
const LANGUAGE_RULE =
	"- Write in the language of the surrounding paragraphs if given, otherwise in the content language";

/**
 * 문체 가이드 공통 문구를 지시문 끝에 붙인다. `styleGuide`가 옵션에 있거나 사이트에 `styleGuide` 공통 문구가 있을 때만이다.
 * 말투·표기 같은 글쓰기 규칙은 지시문이 아니라 이 공통 문구가 맡는다(사이트마다 다르다).
 */
const withStyleGuide = (site: AiSiteView, option: string | undefined, text: string[]): string[] => {
	const styleGuide = styleGuideOf(site, option);
	return styleGuide ? [...text, "", "Style guide:", `{{shared.${styleGuide}}}`] : text;
};

/** 번역할 블록 속성(정의의 `translatable`과, 번역할 자식 속성 값을 가리키는 `childValue`). */
export function translatableAttributes(site: Pick<AiSiteView, "blocks">): string {
	const byName = new Map(site.blocks.map((block) => [block.name, block]));
	return site.blocks
		.flatMap((block) => {
			const names = Object.entries(block.attributes)
				.filter(([, attribute]) => {
					if (attribute.translatable) return true;
					const childValue = attribute.childValue;
					return Boolean(
						childValue &&
							(block.children?.blocks ?? []).some(
								(child) => byName.get(child)?.attributes[childValue]?.translatable === true,
							),
					);
				})
				.map(([name]) => name);
			return names.length > 0 ? [`${block.label}(${names.join("·")})`] : [];
		})
		.join(", ");
}

export const aiPresets = {
	/** 주소(slug) 하나를 만들어 바로 넣는다. 주소 필드(`fields.slug`)에 붙는다. 형식·길이·같은 컬렉션·언어 안의 중복을 검사한다. */
	slug: (options: FieldOptions & { readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) => {
			const targets = fieldTargets(site, options, (schema) => {
				const found = Object.entries(schema.fields).find(([, field]) => field.kind === "slug");
				return found ? { name: found[0], field: found[1] } : undefined;
			});
			if (targets.length === 0) return undefined;
			return aiAction({
				label: t("label.slug"),
				input: fieldInput(),
				// 지금 주소를 함께 보내 누를 때마다 다른 주소를 만들게 한다.
				send: ["title", "body", "current"],
				result: "candidates",
				instant: true,
				checks: [{ kind: "pattern", pattern: KEBAB_PATTERN }, { kind: "maxLength", max: 80 }, uniqueSlug],
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"Write one URL slug in English for the content, based on its title and body.",
							"- If a current value is given, write a different slug",
							"- Use only lowercase English letters, digits and hyphens. No dots, underscores or spaces",
							"- 2 to 5 words. Leave out articles and prepositions where possible",
							"- Make the main topic of the content clear",
						]),
					),
				attach: fieldAttachOf(targets),
			});
		};
	},

	/** 요약 글. 요약 역할(`role: "summary"`) 필드에 붙는다. 글자 수는 필드 `max`, 없으면 160. */
	summary: (options: FieldOptions & { readonly maxLength?: number; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) => {
			const targets = fieldTargets(site, options, (schema) =>
				valueFieldsOf(schema).find((stored) => stored.field.role === SUMMARY_ROLE),
			);
			if (targets.length === 0) return undefined;
			const max = options.maxLength ?? smallestMax(targets) ?? 160;
			return aiAction({
				label: t("label.summary"),
				input: fieldInput(),
				send: ["title", "body"],
				result: "text",
				askInstruction: true,
				checks: [{ kind: "maxLength", max }],
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"Write a summary to show in content lists and share previews.",
							`- 1 to 2 sentences, at most ${max} characters`,
							"- Write in the same language as the body",
							'- Say what the reader can learn from it. Do not start with a phrase like "This article is about"',
						]),
					),
				attach: fieldAttachOf(targets),
			});
		};
	},

	/**
	 * 레코드(분류) 컬렉션을 가리키는 여러 개 관계 필드(예: 태그)에 더할 항목을 판단 모델로 고른다. 선택지는 관계 대상
	 * 컬렉션(`choices`, 없으면 처음 찾은 필드의 대상)이다.
	 */
	tags: (
		options: FieldOptions & { readonly choices?: string; readonly threshold?: number; readonly maxCount?: number } = {},
	) => {
		return (site: AiSiteView) => {
			const first = options.choices ?? firstRelationTarget(site, options, true);
			if (!first) return undefined;
			const targets = fieldTargets(site, options, recordRelation(site, true, first));
			if (targets.length === 0) return undefined;
			return aiAction({
				label: t("label.suggest", { name: targets[0]?.label ?? t("field.tags") }),
				input: fieldInput(),
				send: ["title", "summary", "body"],
				engine: "decide",
				choices: { from: "collection", collection: first },
				pick: "many",
				threshold: options.threshold ?? 0.6,
				maxCount: options.maxCount ?? 5,
				result: "candidates",
				apply: "append",
				checks: [{ kind: "exists" }],
				prompt:
					options.prompt ??
					"Does the content mainly deal with the topic of this item? A passing mention does not count.",
				attach: fieldAttachOf(targets),
			});
		};
	},

	/**
	 * 레코드(분류) 컬렉션을 가리키는 하나 관계 필드(예: 카테고리)에 넣을 항목을 판단 모델로 고른다. 선택지는 관계 대상
	 * 컬렉션(`choices`, 없으면 처음 찾은 필드의 대상)이다.
	 */
	category: (
		options: FieldOptions & { readonly choices?: string; readonly threshold?: number; readonly maxCount?: number } = {},
	) => {
		return (site: AiSiteView) => {
			const first = options.choices ?? firstRelationTarget(site, options, false);
			if (!first) return undefined;
			const targets = fieldTargets(site, options, recordRelation(site, false, first));
			if (targets.length === 0) return undefined;
			const label = targets[0]?.label ?? t("field.category");
			return aiAction({
				label: t("label.suggest", { name: label }),
				input: fieldInput(),
				send: ["title", "summary", "body"],
				engine: "decide",
				choices: { from: "collection", collection: first },
				pick: "one",
				threshold: options.threshold ?? 0.3,
				maxCount: options.maxCount ?? 2,
				result: "candidates",
				checks: [{ kind: "exists" }],
				prompt: options.prompt ?? "Choose the one that this content belongs to.",
				attach: fieldAttachOf(targets),
			});
		};
	},

	/** 본문 이미지의 대체 텍스트. 미디어 화면의 기본 대체 텍스트도 같은 기능을 쓴다. */
	imageAlt: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) =>
			aiAction({
				label: t("label.imageAlt"),
				input: imageInput(),
				send: ["image", "around"],
				result: "candidates",
				askInstruction: true,
				checks: [{ kind: "maxLength", max: 200 }],
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"Write 3 alt text candidates for the image.",
							"- One sentence that lets a reader who cannot see the image know what it shows. If surrounding paragraphs are given, fit the flow of the text",
							LANGUAGE_RULE,
							'- Do not start with words like "image", "photo" or "screenshot"',
							"- If text in the image matters, include what it says",
						]),
					),
				attach: [
					{ slot: "image", target: "alt" },
					{ slot: "media", target: "defaultAlt" },
				],
			});
	},

	/** 본문 이미지의 캡션. 미디어 화면의 기본 캡션도 같은 기능을 쓴다. */
	imageCaption: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) =>
			aiAction({
				label: t("label.imageCaption"),
				input: imageInput(),
				send: ["image", "around"],
				result: "candidates",
				askInstruction: true,
				checks: [{ kind: "maxLength", max: 120 }],
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"Write 3 short caption candidates to place under the image.",
							"- Keep it short, like a label rather than a full sentence",
							LANGUAGE_RULE,
							"- Do not describe the image in detail like alt text",
						]),
					),
				attach: [
					{ slot: "image", target: "caption" },
					{ slot: "media", target: "defaultCaption" },
				],
			});
	},

	/** 미디어 파일 이름 후보. */
	mediaFilename: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) =>
			aiAction({
				label: t("label.mediaFilename"),
				input: {
					image: aiInput.image({ label: t("input.image") }),
					filename: aiInput.text({ label: t("input.filename") }),
					current: aiInput.value({ label: t("input.current") }),
				},
				send: ["image", "filename"],
				result: "candidates",
				checks: [
					{ kind: "pattern", pattern: KEBAB_PATTERN },
					{ kind: "maxLength", max: 80 },
				],
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"Write 3 file name candidates based on what the image shows.",
							"- Use only lowercase English letters, digits and hyphens, in 3 to 6 words",
							"- Do not write a file extension (the original extension is added when saving)",
							'- Do not use words unrelated to the content, like "screenshot", "image" or a date',
						]),
					),
				attach: [{ slot: "media", target: "filename" }],
			});
	},

	/**
	 * 번역본 편집기의 블록 번역. 원문과 뼈대가 같은 MDX만 받는다. 언어가 둘 이상인 사이트에서만 켜진다. 번역할 블록 속성은
	 * 사이트가 쓰는 블록 정의(`translatable`)에서 만든다.
	 */
	translate: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) => {
			if (site.locales.length < 2) return undefined;
			const attributes = translatableAttributes(site);
			return aiAction({
				label: t("label.translate"),
				input: {
					block: aiInput.mdx({ label: t("input.source"), required: true }),
					from: aiInput.locale({ label: t("input.fromLocale"), required: true }),
					to: aiInput.locale({ label: t("input.toLocale"), required: true }),
				},
				result: "mdx",
				askInstruction: true,
				checks: [sameStructure("block")],
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"Translate a part of a document (MDX) from {{from}} to {{to}}.",
							"- Translate only the text people read. Leave MDX syntax, JSX and directive names, code blocks and inline code, formulas, link addresses and image addresses as they are",
							...(attributes ? [`- Translate the values of block attributes that people read: ${attributes}`] : []),
							"- Do not change the number or order of paragraphs, lists and tables. Do not merge or split them",
							"- Carry the tone and style of the source over naturally into the target language",
						]),
					),
				attach: [{ slot: "translation" }],
			});
		};
	},

	/**
	 * 문체 다듬기(M8-2). 본문에서 고른 글을 다듬어 바뀐 곳을 보여 주고, 누르면 고른 글을 바꾼다. 결과는 흘려받는다.
	 * `styleGuide`에 설정 공통 문구(`aiPlugin({ shared })`)의 키를 주면 그 문구(예: 문체 가이드)를 지시문에 넣는다. 없으면
	 * 공통 문구 `styleGuide`가 있을 때 그것을 넣는다. 본문이 있는 컬렉션이 있을 때만 켜진다.
	 */
	polish: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) => {
			if (!hasBody(site)) return undefined;
			return aiAction({
				label: t("label.polish"),
				input: {
					selection: aiInput.mdx({ label: t("input.selection"), required: true }),
					title: aiInput.text({ label: t("input.title") }),
				},
				result: "mdx",
				stream: true,
				askInstruction: true,
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"Polish the writing of the selected part of the content (MDX).",
							"- Keep the meaning and facts, link addresses, code, formulas and MDX syntax as they are",
							"- Rewrite awkward or long sentences so they read naturally and easily. Do not add content that is not there",
							"- Write in the same language and the same tone as the original",
						]),
					),
				attach: [{ slot: "selection" }],
			});
		};
	},

	/**
	 * 초안 쓰기(M8-3). 슬래시 메뉴·빈 문서에서 요청을 받아 커서 자리에 넣을 본문 초안(MDX)을 쓴다. 결과는 흘려받는다.
	 * 문체 가이드는 `polish`와 같다. 본문이 있는 컬렉션이 있을 때만 켜진다.
	 */
	draft: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) => {
			if (!hasBody(site)) return undefined;
			return aiAction({
				label: t("label.draft"),
				input: {
					title: aiInput.text({ label: t("input.title") }),
					body: aiInput.mdx({ label: t("input.currentBody") }),
				},
				result: "mdx",
				stream: true,
				askInstruction: true,
				prompt:
					options.prompt ??
					lines(
						...withStyleGuide(site, options.styleGuide, [
							"From the title, the body written so far and this request, write a draft in MDX to insert at the cursor.",
							"- Start headings in the body at ## (the content title is separate)",
							"- Do not repeat the current body. Continue naturally from the text before and after",
							"- Do not invent facts you do not know. Mark places that need checking with [needs checking]",
							"- Write in the same language as the title",
						]),
					),
				attach: [{ slot: "insert" }],
			});
		};
	},

	/** 코드 블록에서 접어 둘 부분을 찾는 정규식 후보. */
	codeFold: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: t("label.codeFold"),
			input: { code: aiInput.code({ label: t("input.code") }) },
			result: "candidates",
			apply: "append",
			askInstruction: true,
			checks: [regexRuns("code")],
			prompt:
				options.prompt ??
				lines(
					"Write 3 JavaScript regular expression candidates that find parts of the code a reader can safely fold away.",
					"- For example: names in a long import list, long strings, repeated config values, arguments that are not important to the explanation",
					"- Write only the body of the regular expression, without the surrounding slashes and flags",
					"- Match within a single line",
					"- Do not fold the core flow of the code",
				),
			attach: [{ slot: "codeRules", target: "fold" }],
		}),
};

/** 처음 찾은 레코드 관계 필드의 대상 컬렉션(필드 기능이 볼 컬렉션 안에서, 선언 순서). */
function firstRelationTarget(site: AiSiteView, options: FieldOptions, many: boolean): string | undefined {
	for (const [, schema] of candidateCollections(site, options)) {
		const stored = options.field
			? valueFieldsOf(schema).find((item) => item.name === options.field)
			: recordRelation(site, many)(schema);
		if (stored?.field.kind === "relation") return stored.field.to;
	}
	return undefined;
}

const hasBody = (site: AiSiteView) => Object.values(site.collections).some((schema) => schema.body);

/** 지시문에 넣을 공통 문구 이름. 옵션이 없으면 `styleGuide` 문구가 있을 때 그것. */
const styleGuideOf = (site: AiSiteView, option: string | undefined) =>
	option ?? (site.sharedKeys.includes("styleGuide") ? "styleGuide" : undefined);

/**
 * 기본으로 켜는 기능(이름 → 만드는 함수). 순서가 관리자 AI 화면의 순서다(필드 옆 기능이 먼저). 사이트에 붙을 곳이 없으면
 * 켜지지 않는다.
 */
export const DEFAULT_AI_ACTIONS = {
	slug: aiPresets.slug(),
	summary: aiPresets.summary(),
	tags: aiPresets.tags(),
	category: aiPresets.category(),
	imageAlt: aiPresets.imageAlt(),
	imageCaption: aiPresets.imageCaption(),
	mediaFilename: aiPresets.mediaFilename(),
	translate: aiPresets.translate(),
	codeFold: aiPresets.codeFold(),
	polish: aiPresets.polish(),
	draft: aiPresets.draft(),
};
