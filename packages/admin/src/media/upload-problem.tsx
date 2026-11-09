import { Inline, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../operations/admin-context";
import type { Upload } from "./upload-queue";

/** Why a file did not go up, in the words every place shows it in. */
export function useProblemText() {
	const { t } = useAdmin();
	return (upload: Upload) => (upload.problem ? t(`library.failed.${upload.problem}`) : "");
}

/**
 * What can be done about a file that did not go up: what was cut off can be tried again, as it is. One the library will not take has nothing to try: it is taken out, and
 * another goes up (2026-11-09, owner).
 */
export function useProblemActions(onRetry: (upload: Upload) => void) {
	const { t } = useAdmin();
	return (upload: Upload) =>
		upload.problem === "failed" ? [{ label: t("library.retry"), onClick: () => onRetry(upload), primary: true }] : [];
}

/** What can be done, on one line under a file that stays in its place in the text or in a field. The reason is said by the part it sits under. */
export function UploadActions({ upload, onRetry }: { upload: Upload; onRetry: (upload: Upload) => void }) {
	const actions = useProblemActions(onRetry)(upload);
	if (actions.length === 0) return null;
	return (
		<Inline gap={12}>
			{actions.map((action) => (
				<TextButton key={action.label} size="note" onClick={action.onClick}>
					{action.label}
				</TextButton>
			))}
		</Inline>
	);
}
