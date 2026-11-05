import type { Message } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { useOperation } from "../../operations/use-operation";
import type { EntryEditorModel, EntryRead } from "./use-entry-editor";

/** The publish button's look (editor.md, the head): a first publish, a republish with its date menu, or nothing to publish. */
export type PublishButton = "first" | "again" | "done";

/**
 * Publishing from the editor (doc 02, publish): the to-do list, the button's state and the publish itself. It saves first when something is unsaved;
 * what blocks it is the server's answer, the same check the list's publish reads (02-4). `onBlocked` opens the to-do list.
 */
export function usePublish(editor: EntryEditorModel, { onBlocked }: { onBlocked: () => void }) {
	const { t } = useAdmin();
	const op = useOperation<{ output: { published: string[]; blocked: string[] } }>("entries.publish");
	const get = useOperation<EntryRead>("entries.get");
	const read = editor.loaded as EntryRead | null;
	const tasks = read?.tasks ?? [];
	const state = read?.state ?? "draft";
	const button: PublishButton =
		read?.published === null || read === null ? "first" : state === "changed" || editor.dirty ? "again" : "done";

	const publish = async (date: "keep" | "today" = "keep") => {
		if (!read) return;
		if (editor.dirty && !(await editor.save())) return;
		const answer = await op.run({ ids: [read.entry.id], date });
		await editor.reload();
		if (!answer.ok) {
			const reason = answer.refusal.reason as Message | null;
			if (reason?.key === "entries.publishBlocked") {
				toast.error(t("entry.publishBlocked", { count: Number(reason.values?.count ?? 0) }));
				onBlocked();
			} else toast.error(reason ? t(reason) : t("entry.publishFailed"));
			return;
		}
		// The address the site shows it at: a first publish has just made it.
		const fresh = await get.run({ id: read.entry.id });
		const path = fresh.ok ? (fresh.body.published?.path ?? null) : null;
		toast(t("entry.published"), {
			action: path ? { label: t("entry.view"), onClick: () => window.open(path, "_blank", "noopener") } : undefined,
		});
	};

	return {
		tasks,
		blocking: tasks.filter((task) => task.blocking).length,
		button,
		/** The date the site shows, for the menu's "keep" row. */
		publishedAt: read?.published ? new Date(read.published.publishedAt) : null,
		publish,
		publishing: op.pending,
	};
}
