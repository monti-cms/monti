"use client";

import { createContext, type ReactNode, useContext } from "react";

const InBody = createContext(false);

/**
 * Says that what is drawn inside is in the editor's body: the box that scrolls under the editor header and over the review bar. Only what opens from there
 * leaves those bars clear (`usePlacementPadding`); a menu of the sidebar or of a panel, whose tops sit level with the header, keeps the plain window limit.
 */
function BodyScope({ children }: { children: ReactNode }) {
	return <InBody value={true}>{children}</InBody>;
}

/**
 * Says that what is drawn inside is not in the editor's body, though it is drawn from there: a modal (a dialog, a question, a sheet) opened from the body
 * covers the header, so its own menus keep the plain window limit. The shared modal surface (`ModalSurface`) does it once for every modal.
 */
function OutsideBody({ children }: { children: ReactNode }) {
	return <InBody value={false}>{children}</InBody>;
}

/** Whether the part is drawn in the editor's body. */
const useInBody = () => useContext(InBody);

export { BodyScope, OutsideBody, useInBody };
