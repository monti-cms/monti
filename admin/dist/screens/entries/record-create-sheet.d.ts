import { type Collection, type Site } from "@monti-cms/core/client";
import type { TranslatorFor } from "../../translator.js";
import { type EntryData, type EntryFormPatch } from "./entry-form.js";
import { entriesMessages } from "./messages.js";
/** The saved item in the shape of a relation option. */
export declare const optionOf: (site: Site, t: TranslatorFor<typeof entriesMessages>, collection: string, saved: EntryData) => {
    id: string;
    title: string;
    slug: string | null;
};
/**
 * Right-hand sheet for adding a category (tag, category, collection) from the entry edit screen. Opens the same sheet as the category sheet on the list screen
 * and fills in name, slug, description and translations at once. `create(...)` resolves to the created item on save, or null on close.
 * Render `sheet` once on the screen.
 */
export declare function useRecordCreator(): {
    create: (collection: Collection, title: string, more?: EntryFormPatch) => Promise<EntryData | null>;
    sheet: import("react").JSX.Element;
};
