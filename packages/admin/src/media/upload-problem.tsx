import { Inline, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../operations/admin-context";
import { formatBytes } from "./file-text";
import type { Upload } from "./upload-queue";

/** Why a file did not go up, in the words every place shows it in. */
export function useProblemText() {
	const { t } = useAdmin();
	return (upload: Upload) => {
		switch (upload.problem) {
			case null:
				return "";
			case "tooBig":
				return t("library.failed.tooBig", { size: formatBytes(upload.size) });
			case "type":
			case "heic":
			case "notImage":
			case "cannotRead":
			case "unreadable":
			case "failed":
				return t(`library.failed.${upload.problem}`);
		}
	};
}

/** What can be done about a file that did not go up: shrink a picture that is too big, try again what was cut off, or take it out. */
export function useProblemActions({
	onRemove,
	onRetry,
	onShrink,
}: {
	onRemove?: (upload: Upload) => void;
	onRetry: (upload: Upload) => void;
	onShrink: (upload: Upload) => unknown;
}) {
	const { t } = useAdmin();
	return (upload: Upload) => [
		...(upload.problem === "tooBig" && upload.kind === "image"
			? [{ label: t("library.shrink"), onClick: () => void onShrink(upload), primary: true }]
			: []),
		...(upload.problem === "failed"
			? [{ label: t("library.retry"), onClick: () => onRetry(upload), primary: true }]
			: []),
		...(onRemove ? [{ label: t("library.takeOut"), onClick: () => onRemove(upload) }] : []),
	];
}

/** What can be done, on one line under a file that stays in its place in the text or in a field. The reason is said by the part it sits under. */
export function UploadActions({
	upload,
	onRemove,
	onRetry,
	onShrink,
}: {
	upload: Upload;
	onRemove?: (upload: Upload) => void;
	onRetry: (upload: Upload) => void;
	onShrink: (upload: Upload) => unknown;
}) {
	const actions = useProblemActions({ onRemove, onRetry, onShrink })(upload);
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
