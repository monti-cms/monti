interface EntryEditorShellProps {
    mode: "new" | "edit";
    initialEntryId?: string;
    collection?: string;
    /** Admin ID used in the recovery copy key. */
    adminId: string;
    /** Folder to create a new post in (location opened from the list). */
    folderId?: string | null;
}
/**
 * Post and memo edit screen. Tags, categories and collections (record collections) are edited in the small form on the list.
 */
export declare function EntryEditorShell({ mode, initialEntryId, collection: propCollection, adminId, folderId, }: EntryEditorShellProps): import("react").JSX.Element;
export {};
