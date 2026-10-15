import { type Obj, type Rename } from "./schema-model.js";
export declare function CollectionEditor({ name, section, onSection, collection, isNew, onChange, onRemove, onRename, }: {
    name: string;
    /** The open part of the editor (`basics`, `fields` or `editor`); the screen keeps it in the address. */
    section: string | undefined;
    onSection: (section: string) => void;
    collection: Obj;
    /** Not in the file on disk yet: its name can still be taken back. */
    isNew: boolean;
    onChange: (change: (collection: Obj) => Obj) => void;
    onRemove: () => void;
    onRename: (rename: Rename) => void;
}): import("react").JSX.Element;
