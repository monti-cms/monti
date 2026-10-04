import { createTranslator } from "@monti-cms/core/client";
import { z } from "zod";
import { AiError } from "./errors";
import { AI_SHARED } from "./registry";
import { settingsMessages } from "./settings.messages";

const t = createTranslator(settingsMessages);

/**
 * Shared texts. Fill `{{shared.key}}` in the instructions of every action. There are two kinds.
 *
 * - **Config text**: text listed in the plugin config (`aiPlugin({ shared })`). The config decides keys and names; the admin screen edits only the
 *   content (only content differing from the default is kept). Cannot be deleted.
 * - **Added text**: text added in the admin screen by entering key, name and content. The key cannot be changed after creation; delete it if no action uses it.
 *
 * Both are kept in one `shared` row of the AI settings table as `{ texts: { key: edited content }, added: [{ key, label, text }] }`.
 * The old shape (config text key -> edited content) is also read, and saving changes it to the new shape.
 */

export interface AiSharedStore {
	getAiSettings(id: "shared"): Promise<{ value: unknown; version: number } | null>;
	saveAiSettings(params: { id: "shared"; expectedVersion: number; value: unknown }): Promise<number>;
}

/** One shared text shown in the admin screen. */
export type AiSharedItem =
	| {
			source: "config";
			key: string;
			label: string;
			text: string;
			defaultText: string;
			overridden: boolean;
	  }
	| { source: "added"; key: string; label: string; text: string };

export interface AiSharedView {
	version: number;
	/** Config texts (in config order), then added texts (in added order). */
	items: AiSharedItem[];
}

export const MAX_SHARED_TEXT = 4000;
export const MAX_SHARED_LABEL = 40;
/** Number of texts that can be added. */
export const MAX_ADDED_SHARED = 30;
/** Shared text key. Same as the config's naming rule (`validateAiConfig`). */
export const SHARED_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

type AddedText = { key: string; label: string; text: string };
type Stored = { texts: Record<string, string>; added: AddedText[] };

const textSchema = z.string().max(MAX_SHARED_TEXT, t("shared.textTooLong", { max: MAX_SHARED_TEXT }));
const labelSchema = z
	.string()
	.trim()
	.min(1, t("shared.labelRequired"))
	.max(MAX_SHARED_LABEL, t("shared.labelTooLong", { max: MAX_SHARED_LABEL }));
const keySchema = z.string().regex(SHARED_KEY_PATTERN, t("shared.keyFormat"));
const addedSchema = z.object({ key: keySchema, label: labelSchema, text: textSchema });

const storedSchema = z.object({ texts: z.record(z.string(), z.unknown()), added: z.array(z.unknown()) });
const stringsOf = (value: unknown): Record<string, string> =>
	value && typeof value === "object" && !Array.isArray(value)
		? Object.fromEntries(
				Object.entries(value).filter(
					(entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length <= MAX_SHARED_TEXT,
				),
			)
		: {};

const isConfigKey = (key: string) => Object.hasOwn(AI_SHARED, key);

/**
 * Reads stored values. Entries that do not fit are dropped one by one (the rest are kept). For an added text whose key collides with a config text,
 * the config wins (when the same key was later added to the config).
 */
function readStored(value: unknown): Stored {
	const current = storedSchema.safeParse(value);
	if (!current.success) return { texts: stringsOf(value), added: [] };
	const seen = new Set<string>();
	const added = current.data.added.flatMap((item) => {
		const parsed = addedSchema.safeParse(item);
		if (!parsed.success || isConfigKey(parsed.data.key) || seen.has(parsed.data.key)) return [];
		seen.add(parsed.data.key);
		return [parsed.data];
	});
	return { texts: stringsOf(current.data.texts), added };
}

async function load(store: Pick<AiSharedStore, "getAiSettings">): Promise<{ version: number; stored: Stored }> {
	const row = await store.getAiSettings("shared");
	return { version: row?.version ?? 0, stored: readStored(row?.value) };
}

const viewOf = (version: number, stored: Stored): AiSharedView => ({
	version,
	items: [
		...Object.entries(AI_SHARED).map(
			([key, definition]): AiSharedItem => ({
				source: "config",
				key,
				label: definition.label,
				text: stored.texts[key] ?? definition.text,
				defaultText: definition.text,
				overridden: Object.hasOwn(stored.texts, key),
			}),
		),
		...stored.added.map((item): AiSharedItem => ({ source: "added", ...item })),
	],
});

async function write(store: AiSharedStore, expectedVersion: number, stored: Stored): Promise<AiSharedView> {
	const version = await store.saveAiSettings({ id: "shared", expectedVersion, value: stored });
	return viewOf(version, stored);
}

const invalid = (message: string) => new AiError("ai_invalid_input", message);
const unknownKey = (key: string) => invalid(t("shared.unknown", { key }));

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
	const parsed = schema.safeParse(input);
	if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? t("shared.invalid"));
	return parsed.data;
}

/** Changes the content of a config text. If it equals the default, the edited value is removed (revert). */
function setConfigText(stored: Stored, key: string, text: string): Stored {
	const { [key]: _old, ...texts } = stored.texts;
	return { ...stored, texts: text === AI_SHARED[key]?.text ? texts : { ...texts, [key]: text } };
}

/** Shared texts to show in the admin screen. */
export async function getSharedView(store: AiSharedStore): Promise<AiSharedView> {
	const { version, stored } = await load(store);
	return viewOf(version, stored);
}

/** Shared texts to put into the instructions (key -> content). Config texts have edited values applied, and added texts are included too. */
export async function loadSharedTexts(store: Pick<AiSharedStore, "getAiSettings">): Promise<Record<string, string>> {
	const { version, stored } = await load(store);
	return Object.fromEntries(viewOf(version, stored).items.map((item) => [item.key, item.text]));
}

/** Keys usable as `{{shared.key}}` in the instructions (config texts and added texts). Checked when saving instructions in the admin screen. */
export async function loadSharedKeys(store: Pick<AiSharedStore, "getAiSettings">): Promise<string[]> {
	return Object.keys(await loadSharedTexts(store));
}

/** Adds a shared text. The body is `{ key, label, text }`. The key must not collide with config texts or added texts. */
export async function addShared(store: AiSharedStore, expectedVersion: number, input: unknown): Promise<AiSharedView> {
	const item = parse(addedSchema, input);
	const { stored } = await load(store);
	if (isConfigKey(item.key) || stored.added.some((added) => added.key === item.key)) {
		throw invalid(t("shared.keyTaken", { key: item.key }));
	}
	if (stored.added.length >= MAX_ADDED_SHARED) throw invalid(t("shared.tooMany", { max: MAX_ADDED_SHARED }));
	return write(store, expectedVersion, { ...stored, added: [...stored.added, item] });
}

const itemUpdateSchema = z.object({ key: z.string(), label: labelSchema.optional(), text: textSchema });

/**
 * Edits one shared text. The body is `{ key, label?, text }`. A config text edits only content (the config decides the name),
 * and an added text edits name and content. The key is not changed.
 */
export async function updateSharedItem(
	store: AiSharedStore,
	expectedVersion: number,
	input: unknown,
): Promise<AiSharedView> {
	const { key, label, text } = parse(itemUpdateSchema, input);
	const { stored } = await load(store);
	if (isConfigKey(key)) return write(store, expectedVersion, setConfigText(stored, key, text));
	const index = stored.added.findIndex((item) => item.key === key);
	const current = stored.added[index];
	if (!current) throw unknownKey(key);
	const added = stored.added.map((item, i) => (i === index ? { key, label: label ?? current.label, text } : item));
	return write(store, expectedVersion, { ...stored, added });
}

const textsUpdateSchema = z.object({ texts: z.record(z.string(), textSchema) });

/**
 * Edits the content of several shared texts at once. The body is `{ texts: { key: content } }`, and texts not listed are left alone.
 * For config texts, an edited value equal to the default is removed. Unknown keys are rejected.
 */
export async function updateShared(
	store: AiSharedStore,
	expectedVersion: number,
	input: unknown,
): Promise<AiSharedView> {
	const { texts } = parse(textsUpdateSchema, input);
	let { stored } = await load(store);
	for (const [key, text] of Object.entries(texts)) {
		if (isConfigKey(key)) {
			stored = setConfigText(stored, key, text);
			continue;
		}
		if (!stored.added.some((item) => item.key === key)) throw unknownKey(key);
		stored = { ...stored, added: stored.added.map((item) => (item.key === key ? { ...item, text } : item)) };
	}
	return write(store, expectedVersion, stored);
}

/** Whether the instructions use this text as `{{shared.key}}`. */
export function usesShared(prompt: string, key: string): boolean {
	return new RegExp(`\\{\\{\\s*shared\\.${key}\\s*\\}\\}`).test(prompt);
}

/**
 * Deletes an added text. A config text cannot be deleted. If an action uses this text in its instructions (`features`: code action instructions and
 * edited instructions, UI actions), it is blocked and the action names are reported.
 */
export async function deleteShared(
	store: AiSharedStore,
	expectedVersion: number,
	key: string,
	features: readonly { readonly label: string; readonly prompt: string }[],
): Promise<AiSharedView> {
	if (isConfigKey(key)) throw invalid(t("shared.configCannotDelete"));
	const { stored } = await load(store);
	if (!stored.added.some((item) => item.key === key)) throw unknownKey(key);
	const users = features.filter((feature) => usesShared(feature.prompt, key)).map((feature) => feature.label);
	if (users.length > 0) throw invalid(t("shared.inUse", { users: users.join(", ") }));
	return write(store, expectedVersion, { ...stored, added: stored.added.filter((item) => item.key !== key) });
}
