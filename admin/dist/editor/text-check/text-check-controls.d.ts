import type { TextCheckController } from "./use-text-check.js";
/** Checker buttons of the toolbar (one per checker) and the result count (click for the result list). */
export declare function TextCheckToolbar({ controller }: {
    controller: TextCheckController;
}): import("react").JSX.Element;
/** Result popup that appears at the spot when an underline is clicked or picked from the list: explanation, replacement candidates, ignore. */
export declare function TextIssuePopover({ controller }: {
    controller: TextCheckController;
}): import("react").JSX.Element;
