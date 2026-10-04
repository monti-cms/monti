import { type EntryData } from "./entry-form.js";
/**
 * Language tabs above the title. Switch between languages of the same translation group; for a missing language, create a translation.
 * A translation is a draft copied from the original's per-language values and body saved on the server.
 */
export declare function LanguageTabs({ entry, disabled, onBeforeCreate, onTrashTranslation, }: {
    entry: EntryData;
    disabled: boolean;
    /** Blocks translation creation when there are unsaved changes. */
    onBeforeCreate: () => Promise<boolean>;
    onTrashTranslation: () => void;
}): import("react").JSX.Element;
