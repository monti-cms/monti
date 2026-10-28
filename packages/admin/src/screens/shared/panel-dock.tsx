"use client";

import { createContext, useContext } from "react";

/**
 * The place at the window's right edge where a side panel docks: the admin frame makes it, full height, beside the whole page. `undefined` where there is
 * no frame around (a panel drawn alone), `null` while the frame's place is not mounted yet.
 */
export const PanelDockContext = createContext<HTMLElement | null | undefined>(undefined);

export const usePanelDock = () => useContext(PanelDockContext);
