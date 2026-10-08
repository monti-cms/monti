import { type StoredDocument } from "../../document.js";
/** The stored document of `source`, with block ids paired with those of `previous`. */
export declare const docOfText: (source: string, previous?: StoredDocument | null) => StoredDocument;
