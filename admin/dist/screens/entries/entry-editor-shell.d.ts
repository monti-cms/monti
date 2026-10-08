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
 * Edit screen of a document entry. Item collections (tags, categories and the like) are edited in the small form on the list.
 */
export declare function EntryEditorShell({ mode, initialEntryId, collection: propCollectionProp, adminId, folderId, }: EntryEditorShellProps): import("react").JSX.Element;
export {};
