import type { TranslatorFor } from "../../translator.js";
import type { schemaFieldsMessages } from "./fields.messages.js";
import { type Obj } from "./schema-model.js";
/** How a kind is drawn in the schema tree: the token and the colour family it takes. */
export type KindTone = "text" | "slug" | "relation" | "backlink" | "select" | "conditional" | "media" | "view";
export interface FieldSummary {
    /** The kind as the tree writes it: `text`, `→ Category`, `→ Tag[]`, `← Series`, `one of`. */
    readonly token: string;
    readonly tone: KindTone;
    readonly required: boolean;
    /** Whether this is the title field of the collection (the tree writes its role before `detail`). */
    readonly isTitle: boolean;
    /** The settings of the field in a few words, e.g. `a | b | c` for a select. */
    readonly detail: string;
}
/** One line for a field of a collection: its kind token, whether it is required, and its settings in a few words. */
export declare function summarizeField(t: TranslatorFor<typeof schemaFieldsMessages>, name: string, field: Obj, collection: Obj, file: Obj, topLevel: boolean): FieldSummary;
/** The fields of one option of a conditional field (empty when the option adds none). */
export declare function branchFields(field: Obj, option: string): Record<string, Obj>;
