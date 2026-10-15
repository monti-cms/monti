import { type ReactNode } from "react";
/**
 * Guards a screen with unsaved changes against leaving: the browser asks before a reload or a closed tab, and a click on a link inside the
 * admin asks with the same discard dialog the rest of the admin uses. Links inside an element marked `data-unsaved-guard="off"` are not a way out and pass. Render the returned `dialog` once on the screen.
 */
export declare function useUnsavedGuard(dirty: boolean): {
    dialog: ReactNode;
};
