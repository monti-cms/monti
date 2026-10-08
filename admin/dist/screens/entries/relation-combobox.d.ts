export interface RelationOption {
    value: string;
    label: string;
}
interface RelationComboboxProps {
    /** The choices. With `onSearch` these are what the server found for the typed text, shown as they are (not filtered again here). */
    options: readonly RelationOption[];
    /**
     * Names of values that may not be among `options` (the picked ones, when the options are a search result). Used to label picked values.
     */
    known?: readonly RelationOption[];
    /**
     * Called with the typed text (and with the empty text when the list closes), so the options can come from a server search.
     * Turns off the filtering done here: the options are already the matches.
     */
    onSearch?: (query: string) => void;
    /** The options for the latest text are on their way. Shown in place of "No matches". */
    loading?: boolean;
    multiple: boolean;
    /** Picked IDs. For a single-pick relation, empty or one. */
    value: readonly string[];
    onValueChange: (value: string[]) => void;
    /** If present, a new item can be added from the search query. Returns the created item's ID, or null if cancelled. */
    onCreate?: (label: string) => Promise<string | null>;
    id?: string;
    placeholder?: string;
    "aria-label"?: string;
    invalid?: boolean;
    describedBy?: string;
    disabled?: boolean;
    /** For multiple, whether to show picked items as chips inside the input. Turn off where the picked list is drawn separately (collection post list). */
    showChips?: boolean;
}
/**
 * Relation input such as tags and categories. Search and pick; for a name that does not exist, `Add 'name'` at the end of the list opens the add sheet
 * (no separate "new item" input row).
 */
export declare function RelationCombobox({ options, known, onSearch, loading, multiple, value, onValueChange, onCreate, id, placeholder, "aria-label": ariaLabel, invalid, describedBy, disabled, showChips, }: RelationComboboxProps): import("react").JSX.Element;
export {};
