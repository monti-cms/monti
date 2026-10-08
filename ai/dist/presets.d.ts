import { type CollectionSchema } from "@monti-cms/core";
import { type AiAttach, type AiSiteView } from "./action.js";
type FieldOptions = {
    /** Name of the field to attach to. If missing, found by field kind, role and relation target. */
    readonly field?: string;
    /** Collections to attach to. If missing, every collection with a body that has a field to attach to. */
    readonly collections?: readonly string[];
    readonly prompt?: string;
};
/** One field to attach to. */
export interface AiFieldTarget {
    readonly collection: string;
    readonly name: string;
    readonly label: string;
    readonly max?: number;
}
/**
 * Finds the field to attach to for each collection. With `field`, the field of that name; otherwise the field `pick` chose. One per collection.
 */
export declare function fieldTargets(site: AiSiteView, options: FieldOptions, pick: (schema: CollectionSchema) => {
    readonly name: string;
    readonly field: {
        readonly label?: string;
    };
} | undefined): AiFieldTarget[];
/** Attach points. One per field name, listing the collections that have it. */
export declare function fieldAttachOf(targets: readonly AiFieldTarget[]): Extract<AiAttach, {
    slot: "field";
}>[];
/** The smallest `max` of the fields to attach to. `undefined` if none. */
export declare const smallestMax: (targets: readonly AiFieldTarget[]) => number | undefined;
/** Format of values using only lowercase letters, digits and hyphens, like slugs and filenames. Filled into the `format` check of the slug and filename presets. */
export declare const KEBAB_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
/** Block attributes to translate (`translatable` in the definition, and `childValue` pointing to the child attribute value to translate). */
export declare function translatableAttributes(site: Pick<AiSiteView, "blocks">): string;
export declare const aiPresets: {
    /** Creates one slug and inserts it directly. Attaches to the slug field (`fields.slug`). Checks format, length and duplicates within the same collection and locale. */
    slug: (options?: FieldOptions & {
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "body", "current"];
        readonly result: "candidates";
        readonly instant: true;
        readonly checks: readonly [{
            readonly kind: "pattern";
            readonly pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$";
        }, {
            readonly kind: "maxLength";
            readonly max: 80;
        }, import("./action.js").AiValidator];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    /** Summary text. Attaches to the field with the summary role (`role: "summary"`). Length is the field's `max`, or 160 if none. */
    summary: (options?: FieldOptions & {
        readonly maxLength?: number;
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "body"];
        readonly result: "text";
        readonly askInstruction: true;
        readonly checks: readonly [{
            readonly kind: "maxLength";
            readonly max: number;
        }];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    /**
     * Picks items to add, with the decide model, for a many-relation field pointing to a record (taxonomy) collection (e.g. tags). The choices are the relation target
     * collection (`choices`, or the target of the first field found).
     */
    tags: (options?: FieldOptions & {
        readonly choices?: string;
        readonly threshold?: number;
        readonly maxCount?: number;
    }) => (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "summary", "body"];
        readonly engine: "decide";
        readonly choices: {
            readonly from: "collection";
            readonly collection: string;
        };
        readonly pick: "many";
        readonly threshold: number;
        readonly maxCount: number;
        readonly result: "candidates";
        readonly apply: "append";
        readonly checks: readonly [{
            readonly kind: "exists";
        }];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    /**
     * Picks the item to set, with the decide model, for a one-relation field pointing to a record (taxonomy) collection (e.g. category). The choices are the relation target
     * collection (`choices`, or the target of the first field found).
     */
    category: (options?: FieldOptions & {
        readonly choices?: string;
        readonly threshold?: number;
        readonly maxCount?: number;
    }) => (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "summary", "body"];
        readonly engine: "decide";
        readonly choices: {
            readonly from: "collection";
            readonly collection: string;
        };
        readonly pick: "one";
        readonly threshold: number;
        readonly maxCount: number;
        readonly result: "candidates";
        readonly checks: readonly [{
            readonly kind: "exists";
        }];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    /** Alt text of body images. The media screen's default alt text uses the same action. */
    imageAlt: (options?: {
        readonly prompt?: string;
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["image", "around"];
        readonly result: "candidates";
        readonly askInstruction: true;
        readonly checks: readonly [{
            readonly kind: "maxLength";
            readonly max: 200;
        }];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "image";
            readonly target: "alt";
        }, {
            readonly slot: "media";
            readonly target: "defaultAlt";
        }];
    } & {
        input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
    /** Caption of body images. The media screen's default caption uses the same action. */
    imageCaption: (options?: {
        readonly prompt?: string;
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["image", "around"];
        readonly result: "candidates";
        readonly askInstruction: true;
        readonly checks: readonly [{
            readonly kind: "maxLength";
            readonly max: 120;
        }];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "image";
            readonly target: "caption";
        }, {
            readonly slot: "media";
            readonly target: "defaultCaption";
        }];
    } & {
        input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
    /** Media filename candidates. */
    mediaFilename: (options?: {
        readonly prompt?: string;
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            filename: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["image", "filename"];
        readonly result: "candidates";
        readonly checks: readonly [{
            readonly kind: "pattern";
            readonly pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$";
        }, {
            readonly kind: "maxLength";
            readonly max: 80;
        }];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "media";
            readonly target: "filename";
        }];
    } & {
        input: {
            readonly image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            readonly filename: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            readonly current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
    /**
     * Block translation in the translation editor. Accepts only MDX with the same skeleton as the source. Enabled only on sites with two or more locales. The block attributes to translate
     * are built from the block definitions the site uses (`translatable`).
     */
    translate: (options?: {
        readonly prompt?: string;
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            block: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            from: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
            to: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
        };
        readonly result: "mdx";
        readonly askInstruction: true;
        readonly checks: readonly [import("./action.js").AiValidator];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "translation";
        }];
    } & {
        input: {
            readonly block: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            readonly from: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
            readonly to: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
        };
        prompt: string;
    }) | undefined;
    /**
     * Style polish. Polishes the text selected in the body, shows what changed, and replaces the selected text on click. The result is streamed.
     * Given the key of a config shared text (`aiPlugin({ shared })`) as `styleGuide`, that text (e.g. a style guide) goes into the prompt. If missing, the shared text
     * `styleGuide` goes in when it exists. Enabled only when some collection has a body.
     */
    polish: (options?: {
        readonly prompt?: string;
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            selection: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
        };
        readonly result: "mdx";
        readonly stream: true;
        readonly askInstruction: true;
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "selection";
        }];
    } & {
        input: {
            readonly selection: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            readonly title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    /**
     * Draft writing. Takes a request from the slash menu or an empty document and writes a body draft (MDX) to insert at the cursor. The result is streamed.
     * The style guide works as in `polish`. Enabled only when some collection has a body.
     */
    draft: (options?: {
        readonly prompt?: string;
        readonly styleGuide?: string;
    }) => (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
        };
        readonly result: "mdx";
        readonly stream: true;
        readonly askInstruction: true;
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "insert";
        }];
    } & {
        input: {
            readonly title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            readonly body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    /** Regex candidates for finding parts of a code block to fold. */
    codeFold: (options?: {
        readonly prompt?: string;
    }) => (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            code: {
                readonly kind: "code";
            } & {
                readonly label: string;
            };
        };
        readonly result: "candidates";
        readonly apply: "append";
        readonly askInstruction: true;
        readonly checks: readonly [import("./action.js").AiValidator];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "codeRules";
            readonly target: "fold";
        }];
    } & {
        input: {
            readonly code: {
                readonly kind: "code";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
};
/**
 * Actions enabled by default (name -> creating function). The order is the admin AI screen's order (field actions first). Not enabled
 * if the site has no attach point.
 */
export declare const DEFAULT_AI_ACTIONS: {
    slug: (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "body", "current"];
        readonly result: "candidates";
        readonly instant: true;
        readonly checks: readonly [{
            readonly kind: "pattern";
            readonly pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$";
        }, {
            readonly kind: "maxLength";
            readonly max: 80;
        }, import("./action.js").AiValidator];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    summary: (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "body"];
        readonly result: "text";
        readonly askInstruction: true;
        readonly checks: readonly [{
            readonly kind: "maxLength";
            readonly max: number;
        }];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    tags: (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "summary", "body"];
        readonly engine: "decide";
        readonly choices: {
            readonly from: "collection";
            readonly collection: string;
        };
        readonly pick: "many";
        readonly threshold: number;
        readonly maxCount: number;
        readonly result: "candidates";
        readonly apply: "append";
        readonly checks: readonly [{
            readonly kind: "exists";
        }];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    category: (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["title", "summary", "body"];
        readonly engine: "decide";
        readonly choices: {
            readonly from: "collection";
            readonly collection: string;
        };
        readonly pick: "one";
        readonly threshold: number;
        readonly maxCount: number;
        readonly result: "candidates";
        readonly checks: readonly [{
            readonly kind: "exists";
        }];
        readonly prompt: string;
        readonly attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
    } & {
        input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            summary: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    imageAlt: (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["image", "around"];
        readonly result: "candidates";
        readonly askInstruction: true;
        readonly checks: readonly [{
            readonly kind: "maxLength";
            readonly max: 200;
        }];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "image";
            readonly target: "alt";
        }, {
            readonly slot: "media";
            readonly target: "defaultAlt";
        }];
    } & {
        input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
    imageCaption: (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["image", "around"];
        readonly result: "candidates";
        readonly askInstruction: true;
        readonly checks: readonly [{
            readonly kind: "maxLength";
            readonly max: 120;
        }];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "image";
            readonly target: "caption";
        }, {
            readonly slot: "media";
            readonly target: "defaultCaption";
        }];
    } & {
        input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            around: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
    mediaFilename: (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            filename: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        readonly send: readonly ["image", "filename"];
        readonly result: "candidates";
        readonly checks: readonly [{
            readonly kind: "pattern";
            readonly pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$";
        }, {
            readonly kind: "maxLength";
            readonly max: 80;
        }];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "media";
            readonly target: "filename";
        }];
    } & {
        input: {
            readonly image: {
                readonly kind: "image";
            } & {
                readonly label: string;
            };
            readonly filename: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            readonly current: {
                readonly kind: "value";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
    translate: (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            block: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            from: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
            to: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
        };
        readonly result: "mdx";
        readonly askInstruction: true;
        readonly checks: readonly [import("./action.js").AiValidator];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "translation";
        }];
    } & {
        input: {
            readonly block: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            readonly from: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
            readonly to: {
                readonly kind: "locale";
            } & {
                readonly label: string;
                readonly required: true;
            };
        };
        prompt: string;
    }) | undefined;
    codeFold: (site: AiSiteView) => {
        readonly label: string;
        readonly input: {
            code: {
                readonly kind: "code";
            } & {
                readonly label: string;
            };
        };
        readonly result: "candidates";
        readonly apply: "append";
        readonly askInstruction: true;
        readonly checks: readonly [import("./action.js").AiValidator];
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "codeRules";
            readonly target: "fold";
        }];
    } & {
        input: {
            readonly code: {
                readonly kind: "code";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    };
    polish: (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            selection: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
        };
        readonly result: "mdx";
        readonly stream: true;
        readonly askInstruction: true;
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "selection";
        }];
    } & {
        input: {
            readonly selection: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
                readonly required: true;
            };
            readonly title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
    draft: (site: AiSiteView) => ({
        readonly label: string;
        readonly input: {
            title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
        };
        readonly result: "mdx";
        readonly stream: true;
        readonly askInstruction: true;
        readonly prompt: string;
        readonly attach: readonly [{
            readonly slot: "insert";
        }];
    } & {
        input: {
            readonly title: {
                readonly kind: "text";
            } & {
                readonly label: string;
            };
            readonly body: {
                readonly kind: "mdx";
            } & {
                readonly label: string;
            };
        };
        prompt: string;
    }) | undefined;
};
export {};
