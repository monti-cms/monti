import { z } from "zod";
/**
 * AI service connections. Several are saved in the admin AI screen's Connections tab, and each action picks which connection's which model to use.
 *
 * - Generation (`chat`): an OpenAI-compatible address (`…/v1`). OpenRouter, OpenCode Go, Gemini, xAI, etc.
 * - Decisions (`decisions`): a System One model that assigns a probability to each choice (e.g. Jev). Addresses like TypeSafe `…/v1/systemone`,
 *   OpenRouter `…/api/alpha/decisions`. Both use the `state`, `model`, `questions` -> `answers` shape.
 *
 * Keys are encrypted and stored on the server, and only the last four characters are shown on screen. Both server and browser use this file.
 */
export const AI_PROVIDER_KINDS = ["chat", "decisions"];
/** Per-kind address and model examples (placeholder text of the input fields). */
export const PROVIDER_EXAMPLES = {
    chat: { url: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
    decisions: { url: "https://api.typesafe.ai/v1/systemone", model: "jev-latest" },
};
const url = z.union([z.literal(""), z.string().trim().url().max(500)]);
export const aiProviderInputSchema = z.object({
    name: z.string().trim().min(1).max(60),
    kind: z.enum(AI_PROVIDER_KINDS),
    url,
    /** If omitted, the stored key is kept as is; `null` deletes it. */
    apiKey: z.string().trim().min(1).max(1000).nullable().optional(),
    /** The model used when the action does not choose one. */
    defaultModel: z.string().trim().max(200),
});
/** Request to add or edit a connection. Conflicts are prevented by the version of the whole config (0 for the first time). */
export const aiProviderRequestSchema = z.object({
    expectedVersion: z.number().int().min(0),
    provider: aiProviderInputSchema,
});
/** Connection check before saving. If `providerId` is given, that connection's key is used when no new key is entered. */
export const aiProviderCheckSchema = z.object({
    providerId: z.string().max(60).optional(),
    /** The name is not used for the check, so it may be empty. */
    provider: aiProviderInputSchema.extend({ name: z.string().max(60) }),
});
export const aiModelsQuerySchema = z.object({
    /** List of saved connections. The server fills in the address and key. */
    providerId: z.string().max(60).optional(),
    /** When fetching the list with an address that is not yet saved. */
    url: url.optional(),
    apiKey: z.string().trim().min(1).max(1000).optional(),
});
