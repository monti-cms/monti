import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

/**
 * The slot the frame keeps for a page's docked panel, beside the box that scrolls the page: `undefined` where there is no frame (a screen drawn alone),
 * `null` for the one commit before the slot exists.
 */
export const PanelSlotContext = createContext<HTMLElement | null | undefined>(undefined);

/**
 * A page's docked panel (an activity's detail, a file's, a trashed item's, the properties, a preview): drawn into the frame's slot beside the page's
 * scroller, as the assistant's panel is, and not in the scroller with the page. It stays this screen's own (its state, its context), only its place on the
 * screen is the frame's. Without a frame it stands where it is written.
 */
export function PagePanel({ children }: { children: ReactNode }) {
	const slot = useContext(PanelSlotContext);
	if (slot === undefined) return children;
	return slot ? createPortal(children, slot) : null;
}
