import { createTranslator } from "@monti-cms/core/client";
import { z } from "zod";
import { AiError } from "./errors";
import { AI_SHARED } from "./registry";
import { settingsMessages } from "./settings.messages";

const t = createTranslator(settingsMessages);

/**
 * 공통 문구(M8-4). 모든 기능의 지시문 `{{shared.키}}`에 들어간다. 두 가지가 있다.
 *
 * - **설정 문구**: 플러그인 설정(`aiPlugin({ shared })`)에 적은 문구. 키·이름은 설정이 정하고, 관리자 화면에서는 내용만
 *   고친다(기본값과 다른 내용만 둔다). 삭제할 수 없다.
 * - **더한 문구**: 관리자 화면에서 키·이름·내용을 적어 더한 문구. 키는 만든 뒤 바꿀 수 없고, 쓰는 기능이 없으면 삭제한다.
 *
 * 둘 다 AI 설정 표의 `shared` 줄 하나에 `{ texts: { 키: 고친 내용 }, added: [{ key, label, text }] }`로 둔다.
 * 예전 모양(설정 문구 키 → 고친 내용)도 읽고, 저장하면 새 모양으로 바뀐다.
 */

export interface AiSharedStore {
	getAiSettings(id: "shared"): Promise<{ value: unknown; version: number } | null>;
	saveAiSettings(params: { id: "shared"; expectedVersion: number; value: unknown }): Promise<number>;
}

/** 관리자 화면에 보이는 공통 문구 하나. */
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
	/** 설정 문구(설정 순서), 그다음 더한 문구(더한 순서). */
	items: AiSharedItem[];
}

export const MAX_SHARED_TEXT = 4000;
export const MAX_SHARED_LABEL = 40;
/** 더할 수 있는 문구 수. */
export const MAX_ADDED_SHARED = 30;
/** 공통 문구 키. 설정의 이름 규칙(`validateAiConfig`)과 같다. */
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
 * 저장한 값을 읽는다. 맞지 않는 항목은 하나씩 버린다(나머지는 남긴다). 설정 문구와 키가 겹치는 더한 문구는
 * 설정이 이긴다(나중에 설정에 같은 키를 적은 경우).
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

/** 설정 문구의 내용을 바꾼다. 기본값과 같으면 고친 값을 지운다(되돌리기). */
function setConfigText(stored: Stored, key: string, text: string): Stored {
	const { [key]: _old, ...texts } = stored.texts;
	return { ...stored, texts: text === AI_SHARED[key]?.text ? texts : { ...texts, [key]: text } };
}

/** 관리자 화면에 보일 공통 문구. */
export async function getSharedView(store: AiSharedStore): Promise<AiSharedView> {
	const { version, stored } = await load(store);
	return viewOf(version, stored);
}

/** 지시문에 넣을 공통 문구(키 → 내용). 설정 문구는 고친 값을 얹고, 더한 문구도 함께 준다. */
export async function loadSharedTexts(store: Pick<AiSharedStore, "getAiSettings">): Promise<Record<string, string>> {
	const { version, stored } = await load(store);
	return Object.fromEntries(viewOf(version, stored).items.map((item) => [item.key, item.text]));
}

/** 지시문에 `{{shared.키}}`로 쓸 수 있는 키(설정 문구와 더한 문구). 관리자 화면에서 지시문을 저장할 때 확인한다. */
export async function loadSharedKeys(store: Pick<AiSharedStore, "getAiSettings">): Promise<string[]> {
	return Object.keys(await loadSharedTexts(store));
}

/** 공통 문구를 더한다. 본문은 `{ key, label, text }`. 키는 설정 문구·더한 문구와 겹치지 않아야 한다. */
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
 * 공통 문구 하나를 고친다. 본문은 `{ key, label?, text }`. 설정 문구는 내용만 고치고(이름은 설정이 정한다),
 * 더한 문구는 이름과 내용을 고친다. 키는 바꾸지 않는다.
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
 * 여러 공통 문구의 내용을 한 번에 고친다. 본문은 `{ texts: { 키: 내용 } }`이고, 적지 않은 문구는 그대로 둔다.
 * 설정 문구는 기본값과 같으면 고친 값을 지운다. 없는 키는 막는다.
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

/** 지시문이 `{{shared.키}}`로 이 문구를 쓰는가. */
export function usesShared(prompt: string, key: string): boolean {
	return new RegExp(`\\{\\{\\s*shared\\.${key}\\s*\\}\\}`).test(prompt);
}

/**
 * 더한 문구를 삭제한다. 설정 문구는 삭제할 수 없다. 지시문에서 이 문구를 쓰는 기능(`features`: 코드 기능의 지시문과
 * 고친 지시문, 화면 기능)이 있으면 막고 그 기능 이름을 알린다.
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
