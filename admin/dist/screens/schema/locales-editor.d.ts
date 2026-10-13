import { type Obj } from "./schema-model.js";
/** The content languages (code, name, admin name) as one list, the default one, and the time zone. A saved language's code is a stored value, so it is not editable; add a new language instead. */
export declare function LocalesEditor({ file, update, }: {
    file: Obj;
    /** The codes in the file on disk (kept for callers; a code never changes after it is added). */
    savedCodes?: readonly string[];
    update: (change: (file: Obj) => Obj) => void;
}): import("react").JSX.Element;
