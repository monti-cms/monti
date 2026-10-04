import { ADDED_BLOCKS, COLLECTIONS, createTranslator, schemaOf, storedField } from "@monti-cms/core/client";
import { z } from "zod";
import { type AiActionDefinition, type AiChoices, type AiInputs, aiActionOverrideSchema, aiInput } from "./action";
import { actionsMessages } from "./actions.messages";
import type { AiEngine, AiResult } from "./definition";
import { presetMessages } from "./presets.messages";

const t = createTranslator(actionsMessages);
const presetText = createTranslator(presetMessages);

/**
 * UI actions. Actions created in the admin AI screen. They use the same runner as code actions and attach to generic slots (next to a field, selection
 * menu, insert menu, body block, body image, media). Inputs are the material the chosen slot provides. Stored in the DB (`ai_custom_actions`).
 *
 * Stored shape: `{ base: { label, surface, result }, override: edited values (instructions, inputs to send, connection, etc.) }`.
 */

export const CUSTOM_KEY_PREFIX = "custom_";

/** Where it attaches. A field is a field name in the collection definition. */
export const customSurfaceSchema = z.discriminatedUnion("slot", [
	z.object({
		slot: z.literal("field"),
		field: z.string().min(1).max(60),
		collections: z.array(z.string().max(40)).max(20).optional(),
	}),
	z.object({ slot: z.literal("selection") }),
	z.object({ slot: z.literal("insert") }),
	z.object({
		slot: z.literal("block"),
		block: z
			.string()
			.regex(/^[a-z][a-z0-9-]*$/)
			.max(60),
	}),
	z.object({ slot: z.literal("image"), target: z.enum(["alt", "caption"]) }),
	z.object({ slot: z.literal("media"), target: z.enum(["filename", "defaultAlt", "defaultCaption"]) }),
]);
export type CustomSurface = z.output<typeof customSurfaceSchema>;

/** The field a field slot points to (from the first collection found). Relation/select fields are looked up among stored fields. */
export function surfaceField(surface: CustomSurface) {
	if (surface.slot !== "field") return undefined;
	const collections = surface.collections?.length ? surface.collections : COLLECTIONS;
	for (const collection of collections) {
		if (!(COLLECTIONS as readonly string[]).includes(collection)) continue;
		const name = collection as (typeof COLLECTIONS)[number];
		// Look at stored fields first (including the selected value of conditional fields), then find fields stored separately, like URLs, in the schema.
		const field = storedField(name, surface.field)?.field ?? schemaOf(name).fields[surface.field];
		if (field) return { collection, field };
	}
	return undefined;
}

/**
 * Options of a field whose values are fixed. For relation fields (tags, categories, collections), the published items of the target collection; for select fields, their options.
 * A field with options only produces candidates, and it is checked that the value actually exists.
 */
export function surfaceChoices(surface: CustomSurface): { choices: AiChoices; many: boolean } | undefined {
	const found = surfaceField(surface);
	if (!found || surface.slot !== "field") return undefined;
	const { collection, field } = found;
	if (field.kind === "relation") return { choices: { from: "collection", collection: field.to }, many: !!field.many };
	if (field.kind === "select") return { choices: { from: "select", collection, field: surface.field }, many: false };
	return undefined;
}

/** Result shapes selectable per slot. Selection, insertion and block change or insert body fragments (MDX). */
export const CUSTOM_RESULTS: Readonly<Record<CustomSurface["slot"], readonly AiResult[]>> = {
	field: ["candidates", "text", "note"],
	selection: ["mdx"],
	insert: ["mdx"],
	block: ["mdx"],
	image: ["candidates", "text"],
	media: ["candidates", "text"],
};

/** Result shapes selectable in a slot. A field with options gets candidates only. */
export const customResults = (surface: CustomSurface): readonly AiResult[] =>
	surfaceChoices(surface) ? ["candidates"] : CUSTOM_RESULTS[surface.slot];

/** Modes selectable in a slot. Decision mode (System One) is used only on fields with options. */
export const customEngines = (surface: CustomSurface): readonly AiEngine[] =>
	surfaceChoices(surface) ? ["decide", "generate"] : ["generate"];

export const customBaseSchema = z
	.object({
		label: z.string().trim().min(1).max(40),
		surface: customSurfaceSchema,
		result: z.enum(["candidates", "text", "mdx", "note"]),
		/** Mode. If absent, it is generation mode (actions created earlier). */
		engine: z.enum(["generate", "decide"]).optional(),
	})
	.refine((base) => customResults(base.surface).includes(base.result), {
		error: () => t("surface.resultNotAllowed"),
		path: ["result"],
	})
	.refine((base) => customEngines(base.surface).includes(base.engine ?? "generate"), {
		error: () => t("surface.decideChoicesOnly"),
		path: ["engine"],
	});
export type CustomBase = z.output<typeof customBaseSchema>;

export const customValueSchema = z.object({ base: customBaseSchema, override: aiActionOverrideSchema });
export type CustomValue = z.output<typeof customValueSchema>;

/** Material (inputs) a slot provides. Required inputs are only those always present in that slot. Names are chosen in the UI language. */
const surfaceInputs = (slot: CustomSurface["slot"]): AiInputs => {
	const text = presetText;
	const fieldInputs = {
		title: aiInput.text({ label: text("input.title") }),
		summary: aiInput.text({ label: text("input.summary") }),
		body: aiInput.mdx({ label: text("input.body") }),
		current: aiInput.value({ label: text("input.current") }),
	};
	switch (slot) {
		case "field":
			return fieldInputs;
		case "selection":
			return {
				selection: aiInput.mdx({ label: text("input.selection"), required: true }),
				title: aiInput.text({ label: text("input.title") }),
			};
		case "insert":
			return {
				title: aiInput.text({ label: text("input.title") }),
				body: aiInput.mdx({ label: text("input.currentBody") }),
			};
		case "block":
			return {
				block: aiInput.mdx({ label: t("input.blockSource"), required: true }),
				title: aiInput.text({ label: text("input.title") }),
			};
		case "image":
			return {
				image: aiInput.image({ label: text("input.image"), required: true }),
				around: aiInput.text({ label: text("input.around") }),
				current: aiInput.value({ label: text("input.current") }),
			};
		case "media":
			return {
				image: aiInput.image({ label: text("input.image"), required: true }),
				filename: aiInput.text({ label: text("input.filename") }),
				current: aiInput.value({ label: text("input.current") }),
			};
	}
};

/** Initial instructions. Edited right away in the admin screen. */
export const CUSTOM_DEFAULT_PROMPT = "Write what to do here.";

/**
 * Decision defaults (threshold probability, max count) of a UI action attached to a relation/select field. Split into fields accepting several values and fields accepting one.
 * Edited in the admin screen.
 */
export const CUSTOM_PICK_DEFAULTS = {
	many: { threshold: 0.6, maxCount: 5 },
	one: { threshold: 0.3, maxCount: 2 },
} as const;

/** Action definition built from the stored base info. Instructions, inputs to send, etc. are decided by the edited values (`override`). */
export function customDefinition(base: CustomBase): AiActionDefinition {
	const picked = surfaceChoices(base.surface);
	if (picked) {
		// Relation/select field: pick among the options. Fields accepting several values (tags) add; fields accepting one replace.
		return {
			label: base.label,
			input: surfaceInputs("field"),
			send: ["title", "summary", "body"],
			prompt: CUSTOM_DEFAULT_PROMPT,
			engine: base.engine ?? "generate",
			choices: picked.choices,
			pick: picked.many ? "many" : "one",
			...CUSTOM_PICK_DEFAULTS[picked.many ? "many" : "one"],
			result: "candidates",
			...(picked.many ? { apply: "append" as const } : {}),
			checks: [{ kind: "exists" }],
			attach: [base.surface],
		};
	}
	const writes = base.surface.slot === "selection" || base.surface.slot === "insert" || base.surface.slot === "block";
	return {
		label: base.label,
		input: surfaceInputs(base.surface.slot),
		prompt: CUSTOM_DEFAULT_PROMPT,
		result: base.result,
		...(base.result === "note" ? { apply: "none" as const } : {}),
		stream: writes,
		attach: [base.surface],
	};
}

/** Blocks a UI action can attach to: blocks added by block extensions or the site config that are edited as editor nodes (excluding child-only blocks). */
export const CUSTOM_BLOCKS = ADDED_BLOCKS.filter((block) => block.editor.view === "node" && !block.parent);

/** Whether the field/block a slot points to exists in the site config. If not, the reason. */
export function surfaceProblem(surface: CustomSurface): string | null {
	if (surface.slot === "block") {
		return CUSTOM_BLOCKS.some((block) => block.name === surface.block)
			? null
			: t("surface.noBlock", { block: surface.block });
	}
	if (surface.slot !== "field") return null;
	const collections = surface.collections?.length ? surface.collections : COLLECTIONS;
	for (const collection of collections) {
		if (!(COLLECTIONS as readonly string[]).includes(collection)) return t("surface.noCollection", { collection });
	}
	const has = (collection: string) => {
		const name = collection as (typeof COLLECTIONS)[number];
		return Boolean(schemaOf(name).fields[surface.field] ?? storedField(name, surface.field));
	};
	return collections.some(has) ? null : t("surface.noField", { field: surface.field });
}

/** Name (key) of a new UI action. Prefixed with `custom_` so it does not collide with code action names. */
export const newCustomKey = () => `${CUSTOM_KEY_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
export const isCustomKey = (key: string) => key.startsWith(CUSTOM_KEY_PREFIX);
