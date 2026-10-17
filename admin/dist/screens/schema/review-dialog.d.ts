import type { ConfigIssue } from "@monti-cms/core/site";
import { type SavedSchema } from "../../api/schema.js";
import type { Rename, SettingChange } from "./schema-model.js";
export interface ReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: unknown;
    renames: readonly Rename[];
    /** The site and admin settings that differ from the file, which the entries do not care about but the writer should still see. */
    settings?: readonly SettingChange[];
    baseHash: string;
    /** The problems of the last check, for the screen to mark. */
    onIssues: (issues: readonly ConfigIssue[]) => void;
    /** The file was saved (and applied). The screen reloads so everything shows the new schema. */
    onSaved: (saved: SavedSchema) => void;
    /** The file was saved but applying it to the database failed. */
    onApplyFailed: () => void;
}
/**
 * Shows what saving would do and saves it. Opening it checks the edit on the server (no write): the problems with JSON paths, the diff, the entries each change
 * touches with a sample linking to them, and a choice of data transform for every change that has more than one way to treat the stored values. Saving writes the file,
 * the types and the dev database; the screen then reloads.
 */
export declare function ReviewDialog({ open, onOpenChange, draft, renames, settings, baseHash, onIssues, onSaved, onApplyFailed, }: ReviewDialogProps): import("react").JSX.Element;
