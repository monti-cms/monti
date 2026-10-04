import type { AiProviderKind } from "../connection.js";
import type { AiCheckKind, AiEngine, AiResult, AiSlot } from "../definition.js";
/** Option names shared by the admin AI screen (slot, result shape, mode, check, connection kind). */
export declare const labelMessages: import("@monti-cms/core").MessageBundle<"check.exists" | "check.maxLength" | "check.oneOf" | "check.pattern" | "engine.decide" | "engine.generate" | "provider.chat" | "provider.decisions" | "result.candidates" | "result.mdx" | "result.note" | "result.text" | "slot.block" | "slot.codeRules" | "slot.field" | "slot.image" | "slot.insert" | "slot.media" | "slot.selection" | "slot.translation" | "target.codeRules.fold" | "target.image.alt" | "target.image.caption" | "target.media.defaultAlt" | "target.media.defaultCaption" | "target.media.filename">;
/** Slot names (Field, Body image, ...). */
export declare const slotLabel: (slot: AiSlot) => string;
/** Target name of a slot outside fields. An unknown target is returned as is. */
export declare const slotTargetLabel: (slot: "image" | "codeRules" | "media", target: string) => string;
export declare const resultLabel: (result: AiResult) => string;
export declare const checkLabel: (kind: AiCheckKind) => string;
export declare const engineLabel: (engine: AiEngine) => string;
export declare const providerKindLabel: (kind: AiProviderKind) => string;
