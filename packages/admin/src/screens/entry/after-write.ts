/**
 * What a write that went through somewhere in the admin (an assistant's proposal applied from its panel, a publish from the list, another of this
 * editor's own controls) means for an open editor (doc 02, principle 3: nothing is written over):
 * - `none`: nothing to do: the editor's own save is under way and reads what it wrote itself, or nothing was read yet;
 * - `reload`: the server's copy comes in quietly, values and state: nothing typed here is lost (nothing is unsaved, or the record is still
 *   the version the screen shows);
 * - `peek`: unsaved changes stand over the screen: the record's version is read first, to know whether the write was to this record;
 * - `notice`: the record changed under unsaved changes: they are not written over, and the editor says so the way a refused save does (the
 *   conflict banner: compare, load the latest).
 */
export type AfterWrite = "none" | "reload" | "peek" | "notice";

export function afterWrite({
	saving,
	dirty,
	shown,
	latest,
}: {
	/** The editor's own save is under way. */
	saving: boolean;
	/** Unsaved changes stand over the saved copy. */
	dirty: boolean;
	/** The version the screen shows (the one its own last save wrote, when it has not read it yet); `null` before the first read. */
	shown: number | null;
	/** The record's version on the server: left out when not read yet, `null` when it could not be read. */
	latest?: number | null;
}): AfterWrite {
	if (saving || shown === null) return "none";
	if (!dirty) return "reload";
	if (latest === undefined) return "peek";
	if (latest === null) return "none";
	return latest === shown ? "reload" : "notice";
}
