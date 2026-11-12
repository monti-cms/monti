import { Button } from "./button";
import { DialogFooter } from "./dialog";
import { useUiLabels } from "./labels";

/**
 * The footer of a dialog that holds a form: a Cancel text button and one pill, right-aligned like every modal's actions. The pill shows `busyLabel`
 * (the labels' "saving") with a spinner while the request runs, keeping its fill. Put it inside the `<form>`; the dialog closes through `onCancel`.
 * Enter in a field of the form presses the pill; Cancel never sends the form. It has no off state: the pill can always be pressed, and a form that is not ready says why at the field that needs fixing (README principle 7).
 */
export function DialogFormFooter({
	onCancel,
	submitLabel,
	busyLabel,
	busy = false,
	cancelLabel,
}: {
	onCancel: () => void;
	submitLabel?: string;
	busyLabel?: string;
	busy?: boolean;
	cancelLabel?: string;
}) {
	const labels = useUiLabels();
	return (
		<DialogFooter>
			{/* Not the form's button: Enter in a field presses the pill, never Cancel (a button without a type is a submit button, and the first one in a form is its default). */}
			<Button type="button" variant="ghost" onClick={onCancel}>
				{cancelLabel ?? labels.cancel}
			</Button>
			<Button type="submit" loading={busy}>
				{busy ? (busyLabel ?? labels.saving) : (submitLabel ?? labels.save)}
			</Button>
		</DialogFooter>
	);
}
