import { Button } from "./button";
import { DialogFooter, useDialogLock } from "./dialog";
import { useUiLabels } from "./labels";

/**
 * The footer of a dialog that holds a form: a Cancel text button and one pill, right-aligned like every modal's actions. The pill shows `busyLabel`
 * (the labels' "saving") with a spinner while the request runs, keeping its fill. Put it inside the `<form>`; the dialog closes through `onCancel`.
 * Enter in a field of the form presses the pill; Cancel never sends the form. With `lockWhileBusy` Cancel is off while the request runs: a
 * request the server cannot take back once it is sent (a key being checked with its service, then stored) is not one a person can leave half
 * way, and the pill beside it says what is going on. The `Dialog` it is in is then locked too, from here and nowhere else: Escape and a press
 * outside do nothing until the request is back (`useDialogLock`). It has no off state: the pill can always be pressed, and a form that is not ready says why at the field that needs fixing (README principle 7).
 */
export function DialogFormFooter({
	onCancel,
	submitLabel,
	busyLabel,
	busy = false,
	lockWhileBusy = false,
	cancelLabel,
}: {
	onCancel: () => void;
	submitLabel?: string;
	busyLabel?: string;
	busy?: boolean;
	/** The window cannot be left while `busy` (Cancel, Escape, a press outside): what was sent cannot be called back. */
	lockWhileBusy?: boolean;
	cancelLabel?: string;
}) {
	const labels = useUiLabels();
	useDialogLock(lockWhileBusy && busy);
	return (
		<DialogFooter>
			{/* Not the form's button: Enter in a field presses the pill, never Cancel (a button without a type is a submit button, and the first one in a form is its default). */}
			<Button type="button" variant="ghost" onClick={onCancel} disabled={lockWhileBusy && busy}>
				{cancelLabel ?? labels.cancel}
			</Button>
			<Button type="submit" loading={busy}>
				{busy ? (busyLabel ?? labels.saving) : (submitLabel ?? labels.save)}
			</Button>
		</DialogFooter>
	);
}
