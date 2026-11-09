import { IconButton } from "@monti-cms/ui";
import { Renew } from "@monti-cms/ui/icons";
import { useAdmin } from "../operations/admin-context";
import type { Upload } from "./upload-queue";

/** Why a file did not go up, in the words every place shows it in. */
export function useProblemText() {
	const { t } = useAdmin();
	return (upload: Upload) => (upload.problem ? t(`library.failed.${upload.problem}`) : "");
}

/**
 * The button a place sets on a file that did not go up: what was cut off can be tried again, as it is. One the library will not take has none: it is taken out, and
 * another goes up (2026-11-09, owner). It is an icon in every place, so that it takes no line of its own: a line would push a tile's row in the grid (2026-11-09, owner).
 */
export function useRetryButton(onRetry: (upload: Upload) => void) {
	const { t } = useAdmin();
	return (upload: Upload) =>
		upload.problem === "failed" ? (
			<IconButton label={t("library.retry")} onClick={() => onRetry(upload)}>
				<Renew aria-hidden />
			</IconButton>
		) : undefined;
}
