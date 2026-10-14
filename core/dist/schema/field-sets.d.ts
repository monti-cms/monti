/**
 * Field sets that plugins offer: a group of fields a plugin works with (the SEO extension's search title, description, share image, ...). The
 * schema screen shows one as an "Add <name> fields" action on the Fields tab and writes the fields into the collection as plain data, so the
 * schema file stays a literal that the screen can edit. The plugin finds its fields by role afterwards, as before. This is data (no functions),
 * so it reaches the browser with the rest of `contributes`.
 */
/** The key of `contributes` in which a plugin lists the field sets it offers. */
export declare const FIELD_SETS_CONTRIBUTION = "fieldSets";
/** One field set. */
export interface PluginFieldSet {
    /** Stable id (`seo`). */
    readonly id: string;
    /** Name shown in the action ("SEO"). */
    readonly label: string;
    /** The set is in a collection when one of its fields has one of these roles. */
    readonly roles: readonly string[];
    /** The fields to add, as the schema file holds them (name → field object). */
    readonly fields: Readonly<Record<string, unknown>>;
}
/** A field set and the plugin that offers it. */
export interface NamedFieldSet extends PluginFieldSet {
    readonly plugin: string;
}
/** The field sets the plugins offer, read from their `contributes` (a plugin of the browser's snapshot has it as data). */
export declare function fieldSetsOf(plugins: readonly {
    readonly name: string;
    readonly contributes?: Readonly<Record<string, unknown>>;
}[]): NamedFieldSet[];
/** Whether a collection (its `fields`) already has the set: any of its fields carries one of the set's roles. */
export declare function hasFieldSet(set: Pick<PluginFieldSet, "roles">, fields: Readonly<Record<string, unknown>>): boolean;
/**
 * `set.fields` renamed to names `fields` does not use yet (`seoTitle` → `seoTitle2` when taken), in the set's order. The fields themselves are copied
 * as they are.
 */
export declare function freshSetFields(set: Pick<PluginFieldSet, "fields">, fields: Readonly<Record<string, unknown>>): Record<string, unknown>;
