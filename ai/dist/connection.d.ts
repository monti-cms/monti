import { z } from "zod";
/**
 * AI service connections. Several are saved in the admin AI screen's Connections tab, and each action picks which connection's which model to use.
 *
 * - Generation (`chat`): an OpenAI-compatible address (`…/v1`). OpenRouter, OpenCode Go, Gemini, xAI, etc.
 * - Decisions (`decisions`): a System One model that assigns a probability to each choice (e.g. Jev). Addresses like TypeSafe `…/v1/systemone`,
 *   OpenRouter `…/api/alpha/decisions`. Both use the `state`, `model`, `questions` -> `answers` shape.
 *
 * Keys live in the central API key store (Tools → API keys); a connection only refers to one, and only the last four characters are shown on screen. Both server and browser use this file.
 */
export declare const AI_PROVIDER_KINDS: readonly ["chat", "decisions"];
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];
/** Per-kind address and model examples (placeholder text of the input fields). */
export declare const PROVIDER_EXAMPLES: Record<AiProviderKind, {
    url: string;
    model: string;
}>;
export declare const aiProviderInputSchema: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<{
        chat: "chat";
        decisions: "decisions";
    }>;
    url: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodString]>;
    key: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        use: z.ZodLiteral<"saved">;
        keyId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        use: z.ZodLiteral<"new">;
        value: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        use: z.ZodLiteral<"none">;
    }, z.core.$strip>], "use">>;
    defaultModel: z.ZodString;
}, z.core.$strip>;
export type AiProviderInput = z.output<typeof aiProviderInputSchema>;
/** Request to add or edit a connection. Conflicts are prevented by the version of the whole config (0 for the first time). */
export declare const aiProviderRequestSchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
    provider: z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodEnum<{
            chat: "chat";
            decisions: "decisions";
        }>;
        url: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodString]>;
        key: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            use: z.ZodLiteral<"saved">;
            keyId: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            use: z.ZodLiteral<"new">;
            value: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            use: z.ZodLiteral<"none">;
        }, z.core.$strip>], "use">>;
        defaultModel: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
/** A connection sent to the screen. Has only the last four characters instead of the key. */
export interface AiProviderView {
    id: string;
    name: string;
    kind: AiProviderKind;
    url: string;
    /** The key in the API key store this connection uses (name and last four characters only), or `null`. */
    key: {
        id: string;
        name: string;
        tail: string;
        readable: boolean;
    } | null;
    defaultModel: string;
    /** Is it usable, i.e. address, key and default model are all present? */
    ready: boolean;
}
export interface AiSettingsView {
    version: number;
    providers: AiProviderView[];
    /** Using the fake development connection (`CMS_AI_FAKE=1`). All actions work regardless of the config. */
    fake: boolean;
}
/** Connection check before saving. If `providerId` is given, that connection's key is used when no new key is entered. */
export declare const aiProviderCheckSchema: z.ZodObject<{
    providerId: z.ZodOptional<z.ZodString>;
    provider: z.ZodObject<{
        kind: z.ZodEnum<{
            chat: "chat";
            decisions: "decisions";
        }>;
        url: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodString]>;
        key: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            use: z.ZodLiteral<"saved">;
            keyId: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            use: z.ZodLiteral<"new">;
            value: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            use: z.ZodLiteral<"none">;
        }, z.core.$strip>], "use">>;
        defaultModel: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const aiModelsQuerySchema: z.ZodObject<{
    providerId: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodString]>>;
    keyId: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export interface AiModelInfo {
    id: string;
    name?: string;
}
export type AiCheckResult = {
    ok: true;
    ms: number;
    model: string;
} | {
    ok: false;
    message: string;
};
