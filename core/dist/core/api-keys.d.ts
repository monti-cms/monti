import { z } from "zod";
/**
 * The central API key store as the admin API and the admin UI see it. Key values never appear here: a key is shown by its name and the last
 * characters of its value (`tail`), and the value goes in only when a key is added or replaced.
 */
/** One feature that uses a key (an AI connection, the spell checker, git sync). */
export interface ApiKeyUse {
    /** The plugin that uses the key (`ai`, `text-check-bareun`, `git-sync`). */
    readonly plugin: string;
    /** Which item of the plugin uses it (`connection:<id>`). Stable: it is what is stored, never text. */
    readonly ref: string;
    /** What the admin shows, worked out when the keys are read, in the admin's language and with the item's current name: `AI connection "Claude"`. */
    readonly label: string;
}
/** A key a plugin says it needs (`CmsPlugin.keySlots`), with the key assigned to it. */
export interface ApiKeySlotView {
    readonly plugin: string;
    readonly slot: string;
    /** In the admin language. Display only. */
    readonly label: string;
    /** The service the key is for, in no language ("Bareun"): what a key entered for this slot is named. */
    readonly service: string;
    /** The assigned key (name and last characters only), or `null` when none is assigned yet. */
    readonly key: {
        readonly id: string;
        readonly name: string;
        readonly tail: string;
        readonly readable: boolean;
    } | null;
}
export interface ApiKeyView {
    readonly id: string;
    readonly name: string;
    /** The last four characters of the value, or empty when the value is too short to show any of it safely. */
    readonly tail: string;
    /** `false` when the value cannot be decrypted (the server `secret` changed without listing the old one in `previousSecrets`). */
    readonly readable: boolean;
    readonly version: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    /** Everything that uses the key: items of plugins (an AI connection) and the plugin key slots it is assigned to. */
    readonly uses: readonly ApiKeyUse[];
    /** The slots among `uses` (`ref` is the slot id). They can be cleared; the other uses are changed where they are made. */
    readonly slots: readonly ApiKeyUse[];
}
/** `GET /v1/api-keys`. */
export interface ApiKeyList {
    readonly items: readonly ApiKeyView[];
    /** Whether the server config has a `secret`. Without one nothing can be saved. */
    readonly secretsAvailable: boolean;
    /** The keys the installed plugins ask for, assigned or not. */
    readonly slots: readonly ApiKeySlotView[];
}
/** `PUT /v1/api-keys/slots`: assigns a key to a plugin's slot (`none` clears it). A typed key is saved together with the assignment. */
export declare const assignKeySlotBodySchema: z.ZodObject<{
    plugin: z.ZodString;
    slot: z.ZodString;
    key: z.ZodDiscriminatedUnion<[z.ZodObject<{
        use: z.ZodLiteral<"saved">;
        keyId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        use: z.ZodLiteral<"new">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        use: z.ZodLiteral<"none">;
    }, z.core.$strip>], "use">;
}, z.core.$strip>;
export declare const API_KEY_NAME_MAX = 60;
export declare const API_KEY_VALUE_MAX = 1000;
export declare const createApiKeyBodySchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
}, z.core.$strip>;
export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;
/** Rename, replace the value, or both. */
export declare const patchApiKeyBodySchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PatchApiKeyBody = z.infer<typeof patchApiKeyBodySchema>;
/**
 * What a form sends for the key of one place: a key of the store (`saved`), a value to save into the store as a new key named after the place (`new`), or
 * no key (`none`). The plugin's route passes it to `cms.apiKeys.choose`.
 */
export declare const apiKeyChoiceSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    use: z.ZodLiteral<"saved">;
    keyId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    use: z.ZodLiteral<"new">;
    value: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    use: z.ZodLiteral<"none">;
}, z.core.$strip>], "use">;
export type ApiKeyChoiceInput = z.infer<typeof apiKeyChoiceSchema>;
/**
 * The names a new key can get when its place picks one, in order: `base`, then `base 2`, `base 3`, ... (the store takes the first one that is free;
 * names are compared without regard to case).
 */
export declare function keyNameCandidate(base: string, attempt: number): string;
