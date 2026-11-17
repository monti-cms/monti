import { isEmptyValue, type PublishTask } from "@monti-cms/core";

/** One field as the screen has it now: what was saved and what is typed over it. */
export type FieldNow = { field: string; before: unknown; after: unknown };

/**
 * The publish to-do list as the screen stands, unsaved changes included (TR-16). The server counts the saved copy (`publishTasks`); a field
 * typed into since then is counted again by the same rule, and only such a field: a required one filled here leaves the list, and one emptied
 * here joins it when the server would ask for it (`asked`: required in this entry, in the chosen option, and empty on the site when empty
 * here: not a translation's field that follows its source). Fields nobody touched keep the server's answer, so a translation's fields that
 * are the source's (a video's or a link's address) are never counted as its own empty ones.
 */
export function tasksNow(
	tasks: readonly PublishTask[],
	changed: readonly FieldNow[],
	asked: (field: string) => boolean,
): PublishTask[] {
	const filled = new Set(changed.filter((each) => !isEmptyValue(each.after)).map((each) => each.field));
	const kept = tasks.filter((task) => !(task.code === "required" && task.field && filled.has(task.field)));
	const listed = new Set(kept.filter((task) => task.code === "required").map((task) => task.field));
	const emptied = changed.filter(
		(each) => isEmptyValue(each.after) && !isEmptyValue(each.before) && !listed.has(each.field) && asked(each.field),
	);
	// A row joins where the server would put it: the required rows come first, in the order of the changes.
	const firstOther = kept.findIndex((task) => task.code !== "required");
	const at = firstOther === -1 ? kept.length : firstOther;
	const added: PublishTask[] = emptied.map(({ field }) => ({
		code: "required",
		field,
		blocking: true,
		message: { key: "entries.task.required", values: { field } },
	}));
	return [...kept.slice(0, at), ...added, ...kept.slice(at)];
}
