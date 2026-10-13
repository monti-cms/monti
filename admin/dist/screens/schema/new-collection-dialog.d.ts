type Kind = "document" | "item";
/** Name, kind and public address of a new collection. The address follows the name until the writer types one of their own. */
export declare function NewCollectionDialog({ open, onOpenChange, taken, onCreate, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taken: readonly string[];
    onCreate: (name: string, kind: Kind, path: string) => void;
}): import("react").JSX.Element;
export {};
