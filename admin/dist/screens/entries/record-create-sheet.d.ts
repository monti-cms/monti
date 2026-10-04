import type { Collection } from "@monti-cms/core/client";
import type { EntryData, EntryFormPatch } from "./entry-form.js";
/** The saved item in the shape of a relation option. */
export declare const optionOf: (saved: EntryData) => {
    id: string;
    title: string;
    slug: string | null;
};
/**
 * Right-hand sheet for adding a category (tag, category, collection) from the post edit screen. Opens the same sheet as the category sheet on the list screen
 * and fills in name, slug, description and translations at once. `create(...)` resolves to the created item on save, or null on close.
 * Render `sheet` once on the screen.
 */
export declare function useRecordCreator(): {
    create: (collection: Collection, initial: EntryFormPatch) => Promise<EntryData | null>;
    sheet: import("react").JSX.Element;
};
