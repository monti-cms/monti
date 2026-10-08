import type { BlockDefinition } from "../../blocks/define.js";
import type { CmsJsonValue } from "../../doc/types.js";
/**
 * Reads the attributes of a stored block or mark by its definition into the flat props a component receives.
 *
 * - a boolean is always there (`false` when absent; `true` for `true` and `"true"`);
 * - a string is passed as is (a number is written out); a required string without options is `""` when absent;
 * - a choice (`options`) that is not one of the options is replaced by the default; with no default it is absent;
 * - a value of another kind (an object, a list, a boolean for a string) is malformed: the block goes to the fallback.
 */
export interface ReadAttributes {
    readonly props: Record<string, string | boolean | undefined>;
    /** The names of attributes whose stored value is of the wrong kind. */
    readonly malformed: readonly string[];
}
export declare const readAttributes: (definition: Pick<BlockDefinition, "attributes">, attrs: Record<string, CmsJsonValue> | undefined) => ReadAttributes;
