import type { ScreenContext } from "@monti-cms/ai";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** One tool call as the panel holds it: as the run reports it while it works, or as a stored run gives it back. */
export type ToolPart = {
	type: "tool";
	id: string;
	/** The operation it ran. */
	name: string;
	kind: string;
	input: unknown;
	state: "running" | "done" | "failed";
	/** How many things a read gave. */
	count?: number;
	/** Several reads of one kind in a turn, as they come in. */
	progress?: { done: number; total: number };
};

/** What a read reads, and what its count counts. A read the admin has no word for reads "the site's data": never an operation's name. */
const READS: Record<string, { what: string; unit?: "Entries" | "Files" }> = {
	"entries.query": { what: "entries", unit: "Entries" },
	"entries.get": { what: "entry", unit: "Entries" },
	"body.read": { what: "entry", unit: "Entries" },
	"schema.read": { what: "schema" },
	"media.query": { what: "media", unit: "Files" },
	"media.get": { what: "file", unit: "Files" },
	"folders.tree": { what: "folders" },
	"templates.list": { what: "templates" },
	"templates.get": { what: "templates" },
	"trash.list": { what: "trash" },
	"trash.get": { what: "trash" },
	"blocks.catalog": { what: "blocks" },
};

/** A read of an operation the admin has no word for (a plugin's, one added since): the person is never shown an operation's name. */
const OTHER_READ = { what: "site" } as const;

/** The read a call is, in the admin's words; `null` for a write or a screen tool. */
const readOf = (part: ToolPart): { what: string; unit?: "Entries" | "Files" } | null =>
	READS[part.name] ?? (part.kind === "read" || part.kind === "unknown" ? OTHER_READ : null);

/** Two reads one after the other that a line says the same way ("read an entry", then the entry's body): one line is enough. */
export function sameRead(before: ToolPart, part: ToolPart): boolean {
	const was = readOf(before);
	const now = readOf(part);
	return (
		was !== null &&
		now !== null &&
		was.what === now.what &&
		before.state === part.state &&
		before.count === part.count &&
		before.progress === undefined &&
		part.progress === undefined
	);
}

const SCREEN: Record<string, string> = {
	"screen.openEntry": "panel.screen.openEntry",
	"list.show": "panel.screen.listShow",
	"list.select": "panel.screen.listSelect",
};

/** The name the assistant gave a write's kind of change ("Fill in summaries"): the proposal's group. */
export const groupOf = (input: unknown): string | null => {
	const group = (input as { _group?: unknown } | null)?._group;
	return typeof group === "string" && group.trim() !== "" ? group : null;
};

/**
 * What a tool line says (doc 10, item 25). A read: what it reads, and how many it read once it has. A write: the name of its kind of change, with
 * how many calls of that kind came one after another (`times`). A screen tool: what the screen did. An operation the admin has no word for
 * reads "the site's data", or is "a change" when it writes: the person never sees an operation's name.
 * `cut`: the run ended while this call was going, so the line says it stopped there.
 */
export function toolWords(part: ToolPart, t: Translate, { times = 1, cut = false } = {}): string {
	const read = readOf(part);
	if (read) {
		const what = t(`panel.what.${read.what}`);
		if (cut) return t("panel.stoppedAt", { what });
		if (part.state === "running")
			return part.progress ? t("panel.readingOf", { what, ...part.progress }) : t("panel.reading", { what });
		return part.count !== undefined && read.unit
			? t(`panel.read${read.unit}`, { what, count: part.count })
			: t("panel.read", { what });
	}
	const screen = SCREEN[part.name];
	if (screen) {
		const ids = (part.input as { ids?: unknown[] } | null)?.ids;
		return t(screen, { count: Array.isArray(ids) ? ids.length : 0 });
	}
	const group = groupOf(part.input);
	const what = group ?? t("panel.what.change");
	if (cut) return t("panel.stoppedAt", { what });
	return part.kind === "write" && group ? t("panel.wrote", { group, count: times }) : what;
}

/** A tool's input as the opened line shows it: what was sent, without the group's name (the line already says it). */
export function sentValue(input: unknown): string | null {
	if (input === null || typeof input !== "object") return input === undefined || input === null ? null : String(input);
	const { _group, ...rest } = input as Record<string, unknown>;
	return Object.keys(rest).length === 0 ? null : JSON.stringify(rest, null, 2);
}

/** A chip over the input: one thing that goes along with what is asked. */
export type ContextChip = { id: "screen" | "selection"; label: string };

/** The chips of a screen's context (doc 10, item 26): the open thing, and what is picked in it. */
export function chipsOf(context: ScreenContext | null, t: Translate): ContextChip[] {
	if (!context) return [];
	const chips: ContextChip[] = [];
	const screen =
		context.screen === "entry"
			? "panel.chip.entry"
			: context.screen === "list"
				? "panel.chip.list"
				: context.screen === "media"
					? "panel.chip.media"
					: context.screen === "settings"
						? "panel.chip.settings"
						: null;
	if (screen) chips.push({ id: "screen", label: t(screen) });
	const selection = context.selection;
	if (selection?.kind === "text") chips.push({ id: "selection", label: t("panel.chip.text") });
	if (selection?.kind === "rows" && selection.ids.length > 0)
		chips.push({
			id: "selection",
			label: t(context.screen === "media" ? "panel.chip.files" : "panel.chip.rows", { count: selection.ids.length }),
		});
	return chips;
}

/** A screen's context without the chips the person took off: what is sent. Nothing left of it is nothing sent. */
export function contextWithout(
	context: ScreenContext | null,
	removed: ReadonlySet<ContextChip["id"]>,
): ScreenContext | null {
	if (!context) return null;
	if (removed.has("screen")) {
		// Without the screen, what is picked in it still goes: the picked rows are what the request is about.
		if (removed.has("selection") || !context.selection) return null;
		return { screen: context.screen, selection: context.selection };
	}
	if (!removed.has("selection")) return context;
	const { selection: _selection, ...rest } = context;
	return rest;
}
