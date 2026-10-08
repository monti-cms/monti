import type { Site } from "@monti-cms/core/client";
import { z } from "zod";
import { type AiActionDefinition, type AiChoices } from "./action.js";
import type { AiEngine, AiResult } from "./definition.js";
/**
 * UI actions. Actions created in the admin AI screen. They use the same runner as code actions and attach to generic slots (next to a field, selection
 * menu, insert menu, body block, body image, media). Inputs are the material the chosen slot provides. Stored in the DB (`ai_custom_actions`).
 *
 * Stored shape: `{ base: { label, surface, result }, override: edited values (instructions, inputs to send, connection, etc.) }`.
 */
export declare const CUSTOM_KEY_PREFIX = "custom_";
/** Where it attaches. A field is a field name in the collection definition. */
export declare const customSurfaceSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    slot: z.ZodLiteral<"field">;
    field: z.ZodString;
    collections: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    slot: z.ZodLiteral<"selection">;
}, z.core.$strip>, z.ZodObject<{
    slot: z.ZodLiteral<"insert">;
}, z.core.$strip>, z.ZodObject<{
    slot: z.ZodLiteral<"block">;
    block: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    slot: z.ZodLiteral<"image">;
    target: z.ZodEnum<{
        alt: "alt";
        caption: "caption";
    }>;
}, z.core.$strip>, z.ZodObject<{
    slot: z.ZodLiteral<"media">;
    target: z.ZodEnum<{
        defaultAlt: "defaultAlt";
        defaultCaption: "defaultCaption";
        filename: "filename";
    }>;
}, z.core.$strip>], "slot">;
export type CustomSurface = z.output<typeof customSurfaceSchema>;
/** The field a field slot points to (from the first collection found). Relation/select fields are looked up among stored fields. */
export declare function surfaceField(site: Site, surface: CustomSurface): {
    collection: string;
    field: import("@monti-cms/core").BacklinkField | import("@monti-cms/core").ConditionalField<string> | import("@monti-cms/core").MediaField | import("@monti-cms/core").RelationField | import("@monti-cms/core").SelectField<string> | import("@monti-cms/core").SlugField | import("@monti-cms/core").TextField | import("@monti-cms/core").ViewField;
} | undefined;
/**
 * Options of a field whose values are fixed. For relation fields (tags, categories, collections), the published items of the target collection; for select fields, their options.
 * A field with options only produces candidates, and it is checked that the value actually exists.
 */
export declare function surfaceChoices(site: Site, surface: CustomSurface): {
    choices: AiChoices;
    many: boolean;
} | undefined;
/** Result shapes selectable per slot. Selection, insertion and block change or insert body fragments (MDX). */
export declare const CUSTOM_RESULTS: Readonly<Record<CustomSurface["slot"], readonly AiResult[]>>;
/** Result shapes selectable in a slot. A field with options gets candidates only. */
export declare const customResults: (site: Site, surface: CustomSurface) => readonly AiResult[];
/** Modes selectable in a slot. Decision mode (System One) is used only on fields with options. */
export declare const customEngines: (site: Site, surface: CustomSurface) => readonly AiEngine[];
/** Basic info of a screen action, checked against the site (whether the result shape and the mode fit where it attaches). */
export declare const customBaseSchemaOf: (site: Site) => z.ZodObject<{
    label: z.ZodString;
    surface: z.ZodDiscriminatedUnion<[z.ZodObject<{
        slot: z.ZodLiteral<"field">;
        field: z.ZodString;
        collections: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        slot: z.ZodLiteral<"selection">;
    }, z.core.$strip>, z.ZodObject<{
        slot: z.ZodLiteral<"insert">;
    }, z.core.$strip>, z.ZodObject<{
        slot: z.ZodLiteral<"block">;
        block: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        slot: z.ZodLiteral<"image">;
        target: z.ZodEnum<{
            alt: "alt";
            caption: "caption";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        slot: z.ZodLiteral<"media">;
        target: z.ZodEnum<{
            defaultAlt: "defaultAlt";
            defaultCaption: "defaultCaption";
            filename: "filename";
        }>;
    }, z.core.$strip>], "slot">;
    result: z.ZodEnum<{
        candidates: "candidates";
        mdx: "mdx";
        note: "note";
        text: "text";
    }>;
    engine: z.ZodOptional<z.ZodEnum<{
        decide: "decide";
        generate: "generate";
    }>>;
}, z.core.$strip>;
export type CustomBase = z.output<ReturnType<typeof customBaseSchemaOf>>;
/** A stored screen action: its basic info and its edited values. */
export declare const customValueSchemaOf: (site: Site) => z.ZodObject<{
    base: z.ZodObject<{
        label: z.ZodString;
        surface: z.ZodDiscriminatedUnion<[z.ZodObject<{
            slot: z.ZodLiteral<"field">;
            field: z.ZodString;
            collections: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            slot: z.ZodLiteral<"selection">;
        }, z.core.$strip>, z.ZodObject<{
            slot: z.ZodLiteral<"insert">;
        }, z.core.$strip>, z.ZodObject<{
            slot: z.ZodLiteral<"block">;
            block: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            slot: z.ZodLiteral<"image">;
            target: z.ZodEnum<{
                alt: "alt";
                caption: "caption";
            }>;
        }, z.core.$strip>, z.ZodObject<{
            slot: z.ZodLiteral<"media">;
            target: z.ZodEnum<{
                defaultAlt: "defaultAlt";
                defaultCaption: "defaultCaption";
                filename: "filename";
            }>;
        }, z.core.$strip>], "slot">;
        result: z.ZodEnum<{
            candidates: "candidates";
            mdx: "mdx";
            note: "note";
            text: "text";
        }>;
        engine: z.ZodOptional<z.ZodEnum<{
            decide: "decide";
            generate: "generate";
        }>>;
    }, z.core.$strip>;
    override: z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        askInstruction: z.ZodOptional<z.ZodBoolean>;
        instant: z.ZodOptional<z.ZodBoolean>;
        providerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        modelName: z.ZodOptional<z.ZodString>;
        prompt: z.ZodOptional<z.ZodString>;
        send: z.ZodOptional<z.ZodArray<z.ZodString>>;
        threshold: z.ZodOptional<z.ZodNumber>;
        maxCount: z.ZodOptional<z.ZodNumber>;
        checks: z.ZodOptional<z.ZodArray<z.ZodPreprocess<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"pattern">;
            enabled: z.ZodDefault<z.ZodBoolean>;
            pattern: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"maxLength">;
            enabled: z.ZodDefault<z.ZodBoolean>;
            max: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"exists">;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"oneOf">;
            enabled: z.ZodDefault<z.ZodBoolean>;
            items: z.ZodArray<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"code">;
            enabled: z.ZodDefault<z.ZodBoolean>;
            name: z.ZodString;
        }, z.core.$strip>], "kind">, unknown>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type CustomValue = z.output<ReturnType<typeof customValueSchemaOf>>;
/** Initial instructions. Edited right away in the admin screen. */
export declare const CUSTOM_DEFAULT_PROMPT = "Write what to do here.";
/**
 * Decision defaults (threshold probability, max count) of a UI action attached to a relation/select field. Split into fields accepting several values and fields accepting one.
 * Edited in the admin screen.
 */
export declare const CUSTOM_PICK_DEFAULTS: {
    readonly many: {
        readonly threshold: 0.6;
        readonly maxCount: 5;
    };
    readonly one: {
        readonly threshold: 0.3;
        readonly maxCount: 2;
    };
};
/** Action definition built from the stored base info. Instructions, inputs to send, etc. are decided by the edited values (`override`). */
export declare function customDefinition(site: Site, base: CustomBase): AiActionDefinition;
/** Blocks a UI action can attach to: blocks added by block extensions or the site config that are edited as editor nodes (excluding child-only blocks). */
export declare const customBlocksOf: (site: Pick<Site, "ADDED_BLOCKS">) => import("@monti-cms/core").BlockDefinition[];
/** Whether the field/block a slot points to exists in the site config. If not, the reason. */
export declare function surfaceProblem(site: Site, surface: CustomSurface): string | null;
/** Name (key) of a new UI action. Prefixed with `custom_` so it does not collide with code action names. */
export declare const newCustomKey: () => string;
export declare const isCustomKey: (key: string) => boolean;
