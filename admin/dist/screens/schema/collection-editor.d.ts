import { type Obj, type Rename } from "./schema-model.js";
export declare function CollectionEditor({ name, collection, isNew, onChange, onRemove, onRename, }: {
    name: string;
    collection: Obj;
    /** Not in the file on disk yet: its name can still be taken back. */
    isNew: boolean;
    onChange: (change: (collection: Obj) => Obj) => void;
    onRemove: () => void;
    onRename: (rename: Rename) => void;
}): import("react").JSX.Element;
