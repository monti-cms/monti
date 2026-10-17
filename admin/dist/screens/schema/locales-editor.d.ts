import { type Obj } from "./schema-model.js";
/** The content languages (code, name, admin name) as one list, the default one, and the time zone. A saved language's code is a stored value, so it is not editable; add a new language instead. */
export declare function LocalesEditor({ file, update }: {
    file: Obj;
    update: (change: (file: Obj) => Obj) => void;
}): import("react").JSX.Element;
