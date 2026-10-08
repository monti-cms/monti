import { type Obj } from "./schema-model.js";
/** The content locales (code, name, label), the default one, and the time zone. A saved locale's code is a stored value, so it is not editable; add a new locale instead. */
export declare function LocalesEditor({ file, savedCodes, update, }: {
    file: Obj;
    /** The codes in the file on disk. */
    savedCodes: readonly string[];
    update: (change: (file: Obj) => Obj) => void;
}): import("react").JSX.Element;
