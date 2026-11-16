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

/** Whether the part is drawn in the editor's body. */
const useInBody = () => useContext(InBody);

export { BodyScope, useInBody };
