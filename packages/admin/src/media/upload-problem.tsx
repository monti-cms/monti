import { IconButton, toast } from "@monti-cms/ui";
import { Renew } from "@monti-cms/ui/icons";
import { useCallback } from "react";
import { useAdmin } from "../operations/admin-context";
import { refusalOf } from "./put-file";
import type { Refusal } from "./upload-queue";

/**
 * Says which files the library will not take, one toast for each reason: the first file's name and how many more. Nothing stays on the page, as nothing happened: this is the
 * one failure said only in a toast (status.md, 2026-11-09, owner).
 */
export function useSayRefused() {
	const { t } = useAdmin();
	return useCallback(
		(refused: readonly { name: string; refusal: Refusal }[]) => {
			for (const refusal of new Set(refused.map((each) => each.refusal))) {
				const [name = "", ...more] = refused.filter((each) => each.refusal === refusal).map((each) => each.name);
				const reason = t(`library.refused.${refusal}`);
				toast.error(
					more.length > 0
						? t("library.refused.many", { name, count: more.length, reason })
						: t("library.refused.one", { name, reason }),
				);
			}
		},
		[t],
	);
}

/** The files the library would take, of those given. The rest are refused here, as soon as they are dropped or chosen, and go nowhere. */
export function useAcceptFiles() {
	const sayRefused = useSayRefused();
	return useCallback(
		async (files: readonly File[], only?: "image") => {
			const looked = await Promise.all(files.map(async (file) => ({ file, refusal: await refusalOf(file, only) })));
			sayRefused(looked.flatMap(({ file, refusal }) => (refusal ? [{ name: file.name, refusal }] : [])));
			return looked.flatMap(({ file, refusal }) => (refusal ? [] : [file]));
		},
		[sayRefused],
	);
}

/** Tries a file the network cut off again, as it is: an icon in every place, so it takes no line of its own and a tile's row in the grid does not move (2026-11-09, owner). */
export function RetryButton({ onRetry }: { onRetry: () => void }) {
	const { t } = useAdmin();
	return (
		<IconButton label={t("library.retry")} onClick={onRetry}>
			<Renew aria-hidden />
		</IconButton>
	);
}
