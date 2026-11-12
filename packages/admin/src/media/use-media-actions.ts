import { toast } from "@monti-cms/ui";
import { useCallback } from "react";
import { useAdmin } from "../operations/admin-context";
import { reasonOf, useOperation } from "../operations/use-operation";
import { useTrashMove } from "../trash/use-trash";

/** Moves files to a folder, or to the top level (`null`): from the bulk bar, a menu, or a tile dropped on a folder. It says something only when it cannot. */
export function useMoveMedia() {
	const { t } = useAdmin();
	const { run } = useOperation("media.moveToFolder");
	return useCallback(
		async (ids: string[], folder: string | null) => {
			if (ids.length === 0) return false;
			const result = await run({ ids, folder });
			if (!result.ok) toast.error(t(reasonOf(result.refusal)));
			return result.ok;
		},
		[run, t],
	);
}

/**
 * Files to the trash (flow 6·27, 6·28), through the trash like everything else (doc 11): at once, the toast takes them back. A file in use stays, and the toast says
 * how many and shows the first of them, where its uses are listed.
 */
export function useTrashMedia(onShow: (id: string) => void) {
	const trash = useTrashMove();
	return (ids: string[]) => trash.start({ rows: ids.map((id) => ({ kind: "media", id })), onKept: onShow });
}
