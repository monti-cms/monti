import type { ScreenContext } from "@monti-cms/ai";
import { shortDate } from "../screens/list/format";

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

/** What a read reads, and what its count counts. A read the admin has no word for is called by its own name. */
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
 * how many calls of that kind came one after another (`times`). A screen tool: what the screen did. Any other operation: its own name.
 * `cut`: the run ended while this call was going, so the line says it stopped there.
 */
export function toolWords(part: ToolPart, t: Translate, { times = 1, cut = false } = {}): string {
	const read = READS[part.name];
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
	const what = group ?? part.name;
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

/** When something was said, as the activity log writes a time: the hour today ("10:58"), the day and the hour before ("10. 24 10:58"). */
export function clock(at: Date | string, now = new Date()): string {
	const when = new Date(at);
	const time = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
	return when.toDateString() === now.toDateString() ? time : `${shortDate(when, now)} ${time}`;
}
