"use client";

import * as React from "react";

const Slot = React.createContext<React.ReactNode>(null);

/**
 * Where the assistant's ✦ button stands: at the end of the head row of every screen, one button in one place (common.md). The app gives it the
 * button once; `PageHeader` and `EditorHeader` draw it at their end, so a screen never places it. A page with no such head (a login) draws none,
 * and a site without the assistant gives none.
 */
function AssistantSlot({ button, children }: { button: React.ReactNode; children: React.ReactNode }) {
	return <Slot value={button}>{children}</Slot>;
}

/** The ✦ button for the end of a head row (`null` where there is none). */
function useAssistantSlot(): React.ReactNode {
	return React.useContext(Slot);
}

export { AssistantSlot, useAssistantSlot };
