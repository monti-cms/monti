import { z } from "zod";
/** `PUT /v1/api-keys/slots`: assigns a key to a plugin's slot (`none` clears it). A typed key is saved together with the assignment. */
export const assignKeySlotBodySchema = z.object({
    plugin: z.string().min(1).max(100),
    slot: z.string().min(1).max(100),
    key: z.discriminatedUnion("use", [
        z.object({ use: z.literal("saved"), keyId: z.string().min(1).max(100) }),
        z.object({ use: z.literal("new"), value: z.string().trim().min(1).max(1000) }),
        z.object({ use: z.literal("none") }),
    ]),
});
export const API_KEY_NAME_MAX = 60;
export const API_KEY_VALUE_MAX = 1000;
const keyName = z.string().trim().min(1).max(API_KEY_NAME_MAX);
const keyValue = z.string().trim().min(1).max(API_KEY_VALUE_MAX);
export const createApiKeyBodySchema = z.object({ name: keyName, value: keyValue });
/** Rename, replace the value, or both. */
export const patchApiKeyBodySchema = z
    .object({ expectedVersion: z.number().int().min(1), name: keyName.optional(), value: keyValue.optional() })
    .refine((body) => body.name !== undefined || body.value !== undefined, { message: "Give a new name or a new value" });
/**
 * What a form sends for the key of one place: a key of the store (`saved`), a value to save into the store as a new key named after the place (`new`), or
 * no key (`none`). The plugin's route passes it to `cms.apiKeys.choose`.
 */
export const apiKeyChoiceSchema = z.discriminatedUnion("use", [
    z.object({ use: z.literal("saved"), keyId: z.string().min(1).max(100) }),
    z.object({ use: z.literal("new"), value: keyValue }),
    z.object({ use: z.literal("none") }),
]);
/**
 * The name a new key gets when its place picks one: `base`, or `base 2`, `base 3`, ... when that name is taken (names are compared without regard to case).
 */
export function freeKeyName(base, taken) {
    const used = new Set([...taken].map((name) => name.toLowerCase()));
    const clean = base.trim().slice(0, API_KEY_NAME_MAX - 4) || "Key";
    if (!used.has(clean.toLowerCase()))
        return clean;
    for (let n = 2;; n++) {
        const candidate = `${clean} ${n}`;
        if (!used.has(candidate.toLowerCase()))
            return candidate;
    }
}
