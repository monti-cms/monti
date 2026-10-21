export interface ExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The entries to export. Their translations come along, and the dialog says so. */
    ids: readonly string[];
    /** The label of the collection of these entries, for the counts ("3 post entries"). */
    noun?: string;
    /** Which question the dialog asks: about the selected entries, or about the one entry that is open. */
    kind: "selected" | "entry";
    /** The entry being edited has changes that are not saved: the archive holds what is saved, and the dialog says so. */
    unsaved?: boolean;
}
/**
 * The export of selected entries, and of the one that is open in the editor: it states what goes in (the entries, the translations that come with them, the
 * folders, addresses and media records they use), offers the scope and the files, and downloads. The form lives only while the dialog is open, so it counts again each time.
 */
export declare function ExportDialog({ open, onOpenChange, ...body }: ExportDialogProps): import("react").JSX.Element;
