import type { MediaTrashResult } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { useCallback } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";

/** Moves files to a folder, or to the top level (`null`): from the bulk bar, a menu, or a tile dropped on a folder. It says something only when it cannot. */
export function useMoveMedia() {
	const { t } = useAdmin();
	const { run } = useOperation("media.moveToFolder");
	return useCallback(
		async (ids: string[], folder: string | null) => {
			if (ids.length === 0) return false;
			const result = await run({ ids, folder });
			if (!result.ok) toast.error(t(result.refusal.reason ?? "errors.unexpected"));
			return result.ok;
		},
		[run, t],
	);
}

/**
 * Files to the trash (flow 6·27, 6·28): at once, the toast takes them back. A file in use stays, and the toast says how many and shows the first of them, where its uses
 * are listed.
 */
export function useTrashMedia(onShow: (id: string) => void) {
	const { t } = useAdmin();
	const trash = useOperation<{ activityId: string; output: MediaTrashResult }>("media.trash");
	const undo = useOperation("activity.undo");
	return async (ids: string[]) => {
		if (ids.length === 0) return;
		const result = await trash.run({ ids });
		if (!result.ok) return void toast.error(t(result.refusal.reason ?? "errors.unexpected"));
		const { output, activityId } = result.body;
		const [firstKept] = output.kept;
		if (firstKept)
			return void toast(t("library.kept", { moved: output.moved.length, kept: output.kept.length }), {
				action: { label: t("library.show"), onClick: () => onShow(firstKept) },
			});
		toast(t("library.trashed", { count: output.moved.length }), {
			action: { label: t("settings.undo"), onClick: () => void undo.run({ id: activityId }) },
		});
	};
}
