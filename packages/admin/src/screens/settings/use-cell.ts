import type { Path } from "../../draft/use-draft";
import { useAdmin } from "../../operations/admin-context";
import type { SettingsDraft } from "./use-settings-draft";

/**
 * What a place of the draft shows on its label row and in its control (doc 05): my change (the dot and its undo), or the assistant's pending one
 * (blue, its discard, and the saved value struck under the control).
 */
export function useCell(model: SettingsDraft) {
	const { t } = useAdmin();
	const { draft } = model;
	return (path: Path) => {
		const cell = draft.cell(path);
		if (cell.kind === "proposed")
			return {
				value: cell.value,
				proposal: true,
				was: draft.value(path),
				changed: {
					label: t("settings.proposed"),
					tone: "proposal" as const,
					undoLabel: t("settings.discard"),
					onUndo: () => void draft.discard(cell.item.id),
				},
			};
		return {
			value: draft.value(path),
			proposal: false,
			was: undefined,
			changed:
				cell.kind === "mine"
					? { label: t("settings.changed"), undoLabel: t("settings.undo"), onUndo: () => draft.revert(path) }
					: undefined,
		};
	};
}
