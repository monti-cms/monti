import { useTranslator } from "@monti-cms/core/client";
import { commonMessages } from "../lib/common.messages";
import { Button } from "./button";
import { DialogFooter } from "./dialog";

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
	const t = useTranslator(commonMessages);
	return (
		<DialogFooter>
			<Button type="button" variant="outline" onClick={onCancel}>
				{cancelLabel ?? t("cancel")}
			</Button>
			<Button type="submit" disabled={disabled || busy}>
				{busy ? (busyLabel ?? t("saving")) : (submitLabel ?? t("save"))}
			</Button>
		</DialogFooter>
	);
}
