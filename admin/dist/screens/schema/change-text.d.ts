import type { SchemaChange, SuggestedTransform } from "@monti-cms/core/schema-change";
import type { TranslatorFor } from "../../translator.js";
import type { schemaMessages } from "./messages.js";
type T = TranslatorFor<typeof schemaMessages>;
/** A change of the schema as one sentence. */
export declare function describeChange(change: SchemaChange, t: T): string;
/** What a transform does, as a choice label. */
export declare function describeTransform(transform: SuggestedTransform, t: T): string;
/** What leaving the data alone means for a change a transform could handle. */
export declare function describeNoTransform(change: SchemaChange, t: T): string;
export {};
