import { Button } from "./button";
import { DialogFooter } from "./dialog";
import { useUiLabels } from "./labels";
import { TextButton } from "./text-button";

/**
 * The footer of a dialog that holds a form: Cancel and a submit button. The submit button shows `busyLabel` (default "Saving…") while the
 * request runs. Put it inside the `<form>`; the dialog closes through `onCancel`.
 */
export function DialogFormFooter({
	onCancel,
	submitLabel,
	busyLabel,
	busy = false,
	disabled = false,
	cancelLabel,
}: {
	onCancel: () => void;
	submitLabel?: string;
	busyLabel?: string;
	busy?: boolean;
	disabled?: boolean;
	cancelLabel?: string;
}) {
	const labels = useUiLabels();
	return (
		<DialogFooter>
			<TextButton onClick={onCancel}>{cancelLabel ?? labels.cancel}</TextButton>
			<Button type="submit" disabled={disabled || busy}>
				{busy ? (busyLabel ?? labels.saving) : (submitLabel ?? labels.save)}
			</Button>
		</DialogFooter>
	);
}
