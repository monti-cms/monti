type Kind = "document" | "item";
/** Display name, identifier, kind and public address of a new collection. The identifier follows the name and the address follows the identifier, each until the writer types one of their own. */
export declare function NewCollectionDialog({ open, onOpenChange, taken, onCreate, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taken: readonly string[];
    onCreate: (id: string, kind: Kind, path: string, label: string) => void;
}): import("react").JSX.Element;
export {};
