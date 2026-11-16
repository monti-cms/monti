"use client";

import { createContext, type ReactNode, useContext } from "react";

/** Where a part is drawn, as the bars fixed to the window's edges see it: the page, the editor's body, or a modal. */
type BarScope = "page" | "body" | "modal";

const Scope = createContext<BarScope>("page");

/**
 * Says that what is drawn inside is in the editor's body: the box that scrolls under the editor header and over the review bar. Only what opens from there
 * leaves the header clear (`usePlacementPadding`); a menu of the sidebar or of a panel, whose tops sit level with the header, keeps the plain window limit.
 */
function BodyScope({ children }: { children: ReactNode }) {
	return <Scope value="body">{children}</Scope>;
}

/**
 * Says that what is drawn inside is in a modal (a dialog, a question, a sheet), though it may be drawn from the body: a modal covers the header and the
 * review bar, so its own menus keep neither bar's room, only the plain window limit. The shared modal surface (`ModalSurface`) does it once for every modal.
 */
function ModalScope({ children }: { children: ReactNode }) {
	return <Scope value="modal">{children}</Scope>;
}

/** Where the part is drawn: the page, the editor's body or a modal. */
const useBarScope = () => useContext(Scope);

export { BodyScope, ModalScope, useBarScope };
