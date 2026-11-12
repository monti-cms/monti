import { IconButton } from "@monti-cms/ui";
import { Spark } from "@monti-cms/ui/icons";
import { useEffect, useRef } from "react";
import { useAdmin } from "../operations/admin-context";
import { useAssistant } from "./use-assistant";

/**
 * The ✦ at the end of a page's own head (the entry editor, the template editor: common.md, the assistant's button): it opens the
 * assistant's panel beside the page. As in the frame's corner, a site without the assistant has no button, the button is not there while
 * the panel is open, and closing the panel hands the focus back to it.
 */
export function AssistantButton() {
	const { t } = useAdmin();
	const { available, open, setOpen } = useAssistant();
	const button = useRef<HTMLButtonElement>(null);
	const wasOpen = useRef(open);
	useEffect(() => {
		if (wasOpen.current && !open) button.current?.focus();
		wasOpen.current = open;
	}, [open]);
	if (available !== true || open) return null;
	return (
		<IconButton ref={button} label={t("frame.assistant")} side="bottom" onClick={() => setOpen(true)}>
			<Spark aria-hidden />
		</IconButton>
	);
}
