import { type Obj } from "./schema-model.js";
/** The `admin` settings of the file: the admin language and the two switches. The admin path is shown, not edited (the route folder has to move with it). */
export declare function AdminEditor({ file, update }: {
    file: Obj;
    update: (change: (file: Obj) => Obj) => void;
}): import("react").JSX.Element;
