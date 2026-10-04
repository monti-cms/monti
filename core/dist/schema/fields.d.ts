/**
 * Collection field builders. Like Keystatic's `fields.*`, fields are defined in one place in code.
 *
 * Field definitions are used by both the server and the browser, so they hold **only JSON-serializable values**.
 * No functions, React components or secret values. An input override (`input`) points only by name, and the actual implementation lives in the client
 * input registry. The AI button next to an input is not part of the field definition; the screen slot (`src/cms/slots`) attaches it by field name.
 */
/**
 * Whether the value is per language. `true` means each language has its own; `"inherit"` inherits the source value by default but can be changed.
 * If unmarked, the translation group shares it.
 */
export type Localized = boolean | "inherit";
/**
 * The meaning (role) of a field. Extensions and screens look up values by role, not by field name. In one collection, each role
 * has only one field (`defineConfig` checks it). The field kinds that fit a role name are decided and checked by the extension that uses that role
 * (plugin `validate`).
 *
 * The only role the core knows is `summary` (summary, a text field). It is passed as `summary` to actions next to a field (AI etc.) and is the default for list and search result
 * descriptions.
 */
export type FieldRole = string;
export declare const SUMMARY_ROLE = "summary";
interface BaseField {
    readonly label: string;
    /** Help text below the input. */
    readonly description?: string;
    /**
     * A field that must not be empty. Document (`document`) collections check it when publishing, item (`item`) collections when saving.
     * Saving a draft is not blocked. The legacy value `"publish"` is accepted with the same meaning.
     */
    readonly required?: true | "publish";
    readonly localized?: Localized;
    /** Name in the client input registry to use instead of the default input. */
    readonly input?: string;
    /**
     * Settings passed to the default input or the input `input` points to (e.g. recommended character count). The core does not read it. Only JSON values.
     */
    readonly inputOptions?: Readonly<Record<string, string | number | boolean>>;
    /** Only stored and validated; no input is drawn in the properties panel. The stored value is left as is. */
    readonly hidden?: boolean;
    /** The meaning of the field (`FieldRole`). Does not overlap within a collection. */
    readonly role?: FieldRole;
    /**
     * Tab name in which this field is drawn in the edit screen's properties area. A `tab` on a layout group (`layout`) takes precedence. Lets field groups provided by an extension
     * gather in their own tab even if the site does not write a layout. If absent, it is the default tab (`속성`).
     */
    readonly tab?: string;
}
export interface TextField extends BaseField {
    readonly kind: "text";
    /**
     * If empty when publishing, it is filled with plain text from the start of the body. `true` means 160 characters; change it with `{ maxLength }`.
     * Use it only in collections that have a body. If there is no text to fill, it does not publish and tells you to enter this field.
     */
    readonly fillFromBody?: boolean | {
        readonly maxLength?: number;
    };
    readonly multiline?: boolean;
    /** Initial number of rows of a multiline input (`multiline`). 2 rows if absent. */
    readonly rows?: number;
    /** Maximum number of characters (Unicode code points). */
    readonly max?: number;
    readonly placeholder?: string;
}
/** Address. Stored in the content's slug column, not in the metadata. */
export interface SlugField extends BaseField {
    readonly kind: "slug";
    /**
     * Name of the text field read when building the address (usually `title`). The regenerate button and auto generation (while typing a new post, or when a record is saved
     * and the address is empty) use this field's value. If absent, the address is not generated automatically.
     */
    readonly from?: string;
    readonly placeholder?: string;
}
export interface RelationField extends BaseField {
    readonly kind: "relation";
    /** Name of the target collection of the relation. Whether it is a real collection is checked by `defineConfig`. */
    readonly to: string;
    readonly many?: boolean;
    /** Creates a missing target right next to the input. */
    readonly createInline?: boolean;
    /** Shows only published targets when picking. */
    readonly publishedOnly?: boolean;
    /** Unpublished targets do not block publishing either (collection items). */
    readonly allowUnpublished?: boolean;
    /** When there are several, the user decides the order. */
    readonly ordered?: boolean;
    readonly placeholder?: string;
}
export interface SelectField<Option extends string = string> extends BaseField {
    readonly kind: "select";
    /** Value → label. Declaration order is the display order. */
    readonly options: Readonly<Record<Option, string>>;
    readonly defaultValue: Option;
}
/**
 * One file of the media library (the media ID is stored as text). The admin screen takes input through the media picker, and the value is recorded in media
 * usages (`entry_references`), so a file in use cannot be deleted.
 */
export interface MediaField extends BaseField {
    readonly kind: "media";
    /** Files that can be picked. `image` means images only, `file` means any file. If absent, `image`. */
    readonly accept?: "image" | "file";
    readonly placeholder?: string;
}
/**
 * A field with dependent fields that appear depending on the choice value. The choice value is stored under this field's name and the dependent fields under their own names
 * at the top level of the metadata (keeps the legacy storage format). Dependent values are kept only when the condition matches.
 */
export interface ConditionalField<Option extends string = string> extends Omit<BaseField, "label" | "required"> {
    readonly kind: "conditional";
    readonly label: string;
    readonly discriminant: SelectField<Option>;
    readonly values: {
        readonly [K in Option]?: Readonly<Record<string, ValueField>>;
    };
}
/**
 * Reverse relation. Not stored on this content; it shows and changes which of another collection's (`from`) multiple relation fields (`via`)
 * point to this content. Example: the `Collection` in a post's properties panel edits the collection's `itemIds`.
 * The input saves to the other record immediately on click (separate from this content's draft and publish).
 */
export interface BacklinkField extends Omit<BaseField, "required" | "localized"> {
    readonly kind: "backlink";
    /** Name of the other collection that has the relation field. */
    readonly from: string;
    readonly via: string;
    /** Creates a missing target right away, already containing this content. */
    readonly createInline?: boolean;
    readonly placeholder?: string;
    readonly localized?: undefined;
    readonly required?: undefined;
}
/**
 * View field. Stores no value and draws one screen in that spot of the edit screen's properties area (e.g. search results, share preview).
 * `view` is a name registered in the admin extension's `fieldViews`. If no screen is registered, nothing is drawn.
 */
export interface ViewField {
    readonly kind: "view";
    readonly view: string;
    /** Name above the screen. If absent, it is drawn without a name. */
    readonly label?: string;
    readonly description?: string;
    readonly hidden?: boolean;
    /** Tab to draw in (same as `BaseField.tab`). */
    readonly tab?: string;
    readonly localized?: undefined;
    readonly required?: undefined;
    readonly input?: undefined;
}
/**
 * Keys the core uses separately in metadata. They cannot be used as field names (`defineConfig` blocks them).
 * `translations` holds the per-language values of an item collection.
 */
export declare const RESERVED_METADATA_KEYS: readonly string[];
/** Whether the field must not be empty (`required: true` and the legacy value `"publish"`). */
export declare const isRequiredField: (field: {
    readonly required?: true | "publish";
}) => boolean;
/** Default character count when filling from the body. */
export declare const FILL_FROM_BODY_MAX_LENGTH = 160;
/**
 * Character count of a field filled from the body (`fillFromBody`). No longer than the field's `max`. `undefined` for a field that is not filled.
 */
export declare function fillFromBodyLength(field: TextField): number | undefined;
/** A field that stores one value. */
export type ValueField = TextField | RelationField | SelectField | MediaField;
export type Field = ValueField | SlugField | ConditionalField | BacklinkField | ViewField;
export type FieldKind = Field["kind"];
type Options<F extends {
    kind: string;
}> = Omit<F, "kind">;
export declare const fields: {
    text: <const O extends Options<TextField>>(options: O) => {
        readonly kind: "text";
    } & O;
    slug: <const O extends Options<SlugField>>(options: O) => {
        readonly kind: "slug";
    } & O;
    relation: <const O extends Options<RelationField>>(options: O) => {
        readonly kind: "relation";
    } & O;
    backlink: <const O extends Options<BacklinkField>>(options: O) => {
        readonly kind: "backlink";
    } & O;
    view: <const O extends Options<ViewField>>(options: O) => {
        readonly kind: "view";
    } & O;
    select: <const O extends Options<SelectField>>(options: O) => {
        readonly kind: "select";
    } & O;
    media: <const O extends Options<MediaField>>(options: O) => {
        readonly kind: "media";
    } & O;
    conditional: <const D extends SelectField, const V extends ConditionalField["values"]>(discriminant: D, values: V) => {
        readonly kind: "conditional";
        readonly label: string;
        readonly description?: string | undefined;
        readonly discriminant: D;
        readonly values: V;
    };
};
/** Storage format of a field value. */
export type StorageType = "string" | "string[]";
export declare const storageTypeOf: (field: ValueField) => StorageType;
/** TypeScript type of the stored value. */
export type ValueOf<F> = F extends RelationField ? F["many"] extends true ? readonly string[] : string : F extends {
    readonly kind: "select";
    readonly options: infer Options;
} ? keyof Options & string : F extends TextField | MediaField ? string : never;
export {};
