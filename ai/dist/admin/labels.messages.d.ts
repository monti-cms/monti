import { type MessageBundle } from "@monti-cms/core";
import { type Translator } from "@monti-cms/core/client";
import type { AiProviderKind } from "../connection.js";
import type { AiCheckKind, AiEngine, AiResult, AiSlot } from "../definition.js";
type LabelKey = typeof labelMessages extends MessageBundle<infer K> ? K : never;
/** Option names shared by the admin AI screen (slot, result shape, mode, check, connection kind). */
export declare const labelMessages: MessageBundle<"check.exists" | "check.maxLength" | "check.oneOf" | "check.pattern" | "engine.decide" | "engine.generate" | "provider.chat" | "provider.decisions" | "result.candidates" | "result.mdx" | "result.note" | "result.text" | "slot.block" | "slot.codeRules" | "slot.field" | "slot.image" | "slot.insert" | "slot.media" | "slot.selection" | "slot.translation" | "target.codeRules.fold" | "target.image.alt" | "target.image.caption" | "target.media.defaultAlt" | "target.media.defaultCaption" | "target.media.filename">;
/** The option name functions of one translator. */
export declare const labelsOf: (t: Translator<LabelKey>) => {
    /** Slot names (Field, Body image, ...). */
    slotLabel: (slot: AiSlot) => string;
    /** Target name of a slot outside fields. An unknown target is returned as is. */
    slotTargetLabel: (slot: "image" | "codeRules" | "media", target: string) => string;
    resultLabel: (result: AiResult) => string;
    checkLabel: (kind: AiCheckKind) => string;
    engineLabel: (engine: AiEngine) => string;
    providerKindLabel: (kind: AiProviderKind) => string;
};
/** The option name functions in the admin language of the site. */
export declare function useLabels(): {
    /** Slot names (Field, Body image, ...). */
    slotLabel: (slot: AiSlot) => string;
    /** Target name of a slot outside fields. An unknown target is returned as is. */
    slotTargetLabel: (slot: "image" | "codeRules" | "media", target: string) => string;
    resultLabel: (result: AiResult) => string;
    checkLabel: (kind: AiCheckKind) => string;
    engineLabel: (engine: AiEngine) => string;
    providerKindLabel: (kind: AiProviderKind) => string;
};
export {};
