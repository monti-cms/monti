import type { Site } from "@monti-cms/admin";
import { toolLabelMessages } from "./tool-labels.messages";

/** Where a tool call stands, as its line shows it: `stopped` is a call the run never finished (cut off, or stopped). */
export type ToolLineState = "running" | "done" | "failed" | "stopped";

type Translate = ReturnType<Site["createTranslator"]>;

const record = (value: unknown): Record<string, unknown> =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const count = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
const itemsOf = (output: unknown): unknown[] | undefined => {
	const items = record(output).items;
	return Array.isArray(items) ? items : undefined;
};
/** How many the answer says there are: its `total`, or the items it carries. */
const totalOf = (output: unknown): number | undefined => count(record(output).total) ?? itemsOf(output)?.length;

const collectionLabel = (site: Site, input: unknown): string => {
	const name = record(input).collection;
	if (typeof name !== "string") return "";
	return (site.COLLECTION_DEFINITIONS as Record<string, { label?: string } | undefined>)[name]?.label ?? name;
};
const isItems = (site: Site, input: unknown): boolean => {
	const name = record(input).collection;
	return typeof name === "string" && site.isItemCollection(name);
};
const titleOfEntry = (output: unknown): string => {
	const working = record(record(output).working);
	const title = record(working.metadata).title;
	return typeof title === "string" && title ? title : String(record(output).workingSlug ?? "");
};
const filenameOf = (output: unknown): string => String(record(output).filename ?? "");

/**
 * The words of one operation: what it is while it runs ("Reading the entry list"), and what it did with what it found ("Read the entry list · posts 148"). The
 * found part is left out when the answer does not say (a result cut for length).
 */
interface OperationWords {
	readonly running: (t: Translate) => string;
	readonly done: (t: Translate, site: Site, input: unknown, output: unknown) => string;
	/** The name of what was done, for a call that failed or stopped. */
	readonly name: (t: Translate) => string;
}

const joined = (head: string, tail: string | undefined) => (tail ? `${head} · ${tail}` : head);
const counted = (t: Translate, key: string, n: number | undefined, extra: Record<string, string> = {}) =>
	n === undefined ? undefined : t(key, { count: n, ...extra });

const WORDS: Record<string, OperationWords> = {
	"entries.list": {
		running: (t) => t("entries.list.running"),
		// A list of items (tags, categories) is named by its collection; a list of entries is the entry list, counted by its collection.
		done: (t, site, input, output) =>
			isItems(site, input)
				? joined(
						t("entries.list.items", { collection: collectionLabel(site, input) }),
						counted(t, "count.items", totalOf(output)),
					)
				: joined(
						t("entries.list.done"),
						counted(t, "count.entries", totalOf(output), { collection: collectionLabel(site, input) }),
					),
		name: (t) => t("entries.list.name"),
	},
	"entries.find": {
		running: (t) => t("entries.find.running"),
		done: (t, _site, _input, output) => joined(t("entries.find.done"), counted(t, "count.found", totalOf(output))),
		name: (t) => t("entries.find.name"),
	},
	"entries.get": {
		running: (t) => t("entries.get.running"),
		done: (t, _site, _input, output) => joined(t("entries.get.done"), titleOfEntry(output) || undefined),
		name: (t) => t("entries.get.name"),
	},
	"entries.usages": {
		running: (t) => t("entries.usages.running"),
		done: (t, _site, _input, output) => joined(t("entries.usages.done"), counted(t, "count.places", totalOf(output))),
		name: (t) => t("entries.usages.name"),
	},
	"entries.translations": {
		running: (t) => t("entries.translations.running"),
		done: (t) => t("entries.translations.done"),
		name: (t) => t("entries.translations.name"),
	},
	"entries.checkPublish": {
		running: (t) => t("entries.checkPublish.running"),
		done: (t) => t("entries.checkPublish.done"),
		name: (t) => t("entries.checkPublish.name"),
	},
	"folders.list": {
		running: (t) => t("folders.running"),
		done: (t, _site, _input, output) => joined(t("folders.done"), counted(t, "count.items", totalOf(output))),
		name: (t) => t("folders.name"),
	},
	"folders.get": {
		running: (t) => t("folders.running"),
		done: (t) => t("folders.done"),
		name: (t) => t("folders.name"),
	},
	"media.list": {
		running: (t) => t("media.list.running"),
		done: (t, _site, _input, output) => joined(t("media.list.done"), counted(t, "count.files", totalOf(output))),
		name: (t) => t("media.list.name"),
	},
	"media.get": {
		running: (t) => t("media.get.running"),
		done: (t, _site, _input, output) => joined(t("media.get.done"), filenameOf(output) || undefined),
		name: (t) => t("media.get.name"),
	},
	"schema.read": {
		running: (t) => t("schema.running"),
		done: (t) => t("schema.done"),
		name: (t) => t("schema.name"),
	},
	"site.describe": {
		running: (t) => t("site.running"),
		done: (t) => t("site.done"),
		name: (t) => t("site.name"),
	},
	"templates.list": {
		running: (t) => t("templates.running"),
		done: (t, _site, _input, output) => joined(t("templates.done"), counted(t, "count.items", totalOf(output))),
		name: (t) => t("templates.name"),
	},
	"templates.get": {
		running: (t) => t("templates.running"),
		done: (t) => t("templates.done"),
		name: (t) => t("templates.name"),
	},
	"editor.read": {
		running: (t) => t("editor.read.running"),
		done: (t) => t("editor.read.done"),
		name: (t) => t("editor.read.name"),
	},
	"editor.selection": {
		running: (t) => t("editor.selection.running"),
		done: (t) => t("editor.selection.done"),
		name: (t) => t("editor.selection.name"),
	},
};

/**
 * The words of a tool line: what the call did in the admin's language ("Read the entry list · posts 148", "Reading an entry"), "failed" after a call that failed and
 * "stopped here" after one the run never finished. An operation of a plugin, which has no words here, shows its name (`spelling.check`).
 */
export function toolLineText(
	site: Site,
	operation: string,
	state: ToolLineState,
	input: unknown,
	output: unknown,
): string {
	const t = site.createTranslator(toolLabelMessages) as Translate;
	const words = WORDS[operation];
	if (!words) return state === "done" || state === "running" ? operation : joined(operation, t(`state.${state}`));
	if (state === "running") return words.running(t);
	if (state === "done") return words.done(t, site, input, output);
	return joined(words.name(t), t(`state.${state}`));
}
