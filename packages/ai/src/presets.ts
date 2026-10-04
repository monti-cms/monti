import { type CollectionSchema, type StoredField, SUMMARY_ROLE, valueFieldsOf } from "@monti-cms/core";
import { type AiAttach, type AiSiteView, aiAction, aiInput } from "./action";
import { lazyTranslator } from "./i18n";
import { presetMessages } from "./presets.messages";
import { regexRuns, sameStructure, uniqueSlug } from "./validators";

/**
 * Default AI actions (presets). Adding `aiPlugin()` automatically enables the default actions that have an attach point on the site. List only what to change
 * under the same name in `aiPlugin({ actions })` (`false` turns it off).
 *
 * ```ts
 * aiPlugin({ actions: { summary: aiPresets.summary({ maxLength: 120 }), draft: false } })
 * ```
 *
 * Field actions find the field to attach to by field kind, role and relation target, not by field name. They read the body, so they attach only to collections
 * that have a body. The prompt can be edited in the admin AI screen, and the preset option `prompt` can change its initial value.
 */

const t = lazyTranslator(presetMessages);

/** The material a beside-a-field slot provides. A field action can receive all these inputs, and `send` chooses what to send. */
const fieldInput = () => ({
	title: aiInput.text({ label: t("input.title") }),
	summary: aiInput.text({ label: t("input.summary") }),
	body: aiInput.mdx({ label: t("input.body") }),
	current: aiInput.value({ label: t("input.current") }),
});

/** The material received by the image actions (alt text, caption). */
const imageInput = () => ({
	image: aiInput.image({ label: t("input.image") }),
	around: aiInput.text({ label: t("input.around") }),
	current: aiInput.value({ label: t("input.current") }),
});

type FieldOptions = {
	/** Name of the field to attach to. If missing, found by field kind, role and relation target. */
	readonly field?: string;
	/** Collections to attach to. If missing, every collection with a body that has a field to attach to. */
	readonly collections?: readonly string[];
	readonly prompt?: string;
};

/** One field to attach to. */
export interface AiFieldTarget {
	readonly collection: string;
	readonly name: string;
	readonly label: string;
	readonly max?: number;
}

/** The collections a field action looks at: the option's `collections`, otherwise collections with a body. */
const candidateCollections = (site: AiSiteView, options: FieldOptions): [string, CollectionSchema][] =>
	Object.entries(site.collections).filter(([name, schema]) =>
		options.collections ? options.collections.includes(name) : schema.body,
	);

/**
 * Finds the field to attach to for each collection. With `field`, the field of that name; otherwise the field `pick` chose. One per collection.
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

/** Attach points. One per field name, listing the collections that have it. */
export function fieldAttachOf(targets: readonly AiFieldTarget[]): Extract<AiAttach, { slot: "field" }>[] {
	const byName = new Map<string, string[]>();
	for (const { name, collection } of targets) byName.set(name, [...(byName.get(name) ?? []), collection]);
	return [...byName].map(([field, collections]) => ({ slot: "field", field, collections }));
}

/** The smallest `max` of the fields to attach to. `undefined` if none. */
export const smallestMax = (targets: readonly AiFieldTarget[]): number | undefined => {
	const maxes = targets.flatMap((target) => (target.max === undefined ? [] : [target.max]));
	return maxes.length > 0 ? Math.min(...maxes) : undefined;
};

/** A relation field pointing to a record (taxonomy) collection. `many` selects multiple or one. */
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

/** Format of values using only lowercase letters, digits and hyphens, like slugs and filenames. Filled into the `format` check of the slug and filename presets. */
export const KEBAB_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

/** Language to use when there are no surrounding paragraphs. The runner appends "Content language" (the content's language, else the site's default language) to the instruction. */
const LANGUAGE_RULE =
	"- Write in the language of the surrounding paragraphs if given, otherwise in the content language";

/**
 * Appends the style guide shared text to the end of the prompt, only when `styleGuide` is in the options or the site has a `styleGuide` shared text.
 * Writing rules like tone and notation are handled by this shared text, not the prompt (they differ per site).
 */
const withStyleGuide = (site: AiSiteView, option: string | undefined, text: string[]): string[] => {
	const styleGuide = styleGuideOf(site, option);
	return styleGuide ? [...text, "", "Style guide:", `{{shared.${styleGuide}}}`] : text;
};

/** Block attributes to translate (`translatable` in the definition, and `childValue` pointing to the child attribute value to translate). */
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
	/** Creates one slug and inserts it directly. Attaches to the slug field (`fields.slug`). Checks format, length and duplicates within the same collection and locale. */
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
				// Send the current slug too so each press produces a different slug.
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

	/** Summary text. Attaches to the field with the summary role (`role: "summary"`). Length is the field's `max`, or 160 if none. */
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
	 * Picks items to add, with the decide model, for a many-relation field pointing to a record (taxonomy) collection (e.g. tags). The choices are the relation target
	 * collection (`choices`, or the target of the first field found).
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
	 * Picks the item to set, with the decide model, for a one-relation field pointing to a record (taxonomy) collection (e.g. category). The choices are the relation target
	 * collection (`choices`, or the target of the first field found).
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

	/** Alt text of body images. The media screen's default alt text uses the same action. */
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

	/** Caption of body images. The media screen's default caption uses the same action. */
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

	/** Media filename candidates. */
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
	 * Block translation in the translation editor. Accepts only MDX with the same skeleton as the source. Enabled only on sites with two or more locales. The block attributes to translate
	 * are built from the block definitions the site uses (`translatable`).
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
	 * Style polish. Polishes the text selected in the body, shows what changed, and replaces the selected text on click. The result is streamed.
	 * Given the key of a config shared text (`aiPlugin({ shared })`) as `styleGuide`, that text (e.g. a style guide) goes into the prompt. If missing, the shared text
	 * `styleGuide` goes in when it exists. Enabled only when some collection has a body.
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
	 * Draft writing. Takes a request from the slash menu or an empty document and writes a body draft (MDX) to insert at the cursor. The result is streamed.
	 * The style guide works as in `polish`. Enabled only when some collection has a body.
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

	/** Regex candidates for finding parts of a code block to fold. */
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

/** The target collection of the first record relation field found (among the collections the field action looks at, in declaration order). */
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

/** Name of the shared text to put in the prompt. If no option, the `styleGuide` text when it exists. */
const styleGuideOf = (site: AiSiteView, option: string | undefined) =>
	option ?? (site.sharedKeys.includes("styleGuide") ? "styleGuide" : undefined);

/**
 * Actions enabled by default (name -> creating function). The order is the admin AI screen's order (field actions first). Not enabled
 * if the site has no attach point.
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
