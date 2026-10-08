import type { Site } from "@monti-cms/core/client";
import { type AiActionDefinition, type AiActionEditable, type AiActionOverride, type AiAttach, type AiChoices, type AiInputKind, EDITABLE_KEYS, type ResolvedAiAction } from "./action.js";
import { type CustomBase, type CustomValue } from "./custom.js";
import type { AiApply, AiCheck, AiEngine, AiPick, AiResult } from "./definition.js";
/**
 * The shape of an action sent to the admin screen (shared by server and browser). The server builds it from saved values; the admin screen builds it as a preview of a new
 * screen action that is not yet saved.
 */
/** One action sent to the admin screen. The fixed part of the definition and the current value (the edited value applied on top). */
export interface AiActionView extends AiActionEditable {
    key: string;
    label: string;
    result: AiResult;
    apply: AiApply;
    engine: AiEngine;
    pick: AiPick;
    input: Record<string, {
        kind: AiInputKind;
        label: string;
        required: boolean;
    }>;
    choices?: AiChoices;
    attach: readonly AiAttach[];
    checks: AiCheck[];
    /** Checks set by the action definition (`checkKey`, can only be turned off). The rest are checks added in the admin screen. */
    definedChecks: string[];
    /** Code check name -> display name. Code checks can only be turned on or off. */
    validatorLabels: Record<string, string>;
    /** Does the action stream its result? */
    stream: boolean;
    /**
     * The editable values the definition alone gives (what Reset returns to). `null` for a screen action, which has no definition to return to. The server sends it, because
     * the browser's site holds only the data parts of the config (a factory in the config does not reach it).
     */
    defaults: Pick<AiActionView, (typeof EDITABLE_KEYS)[number]> | null;
    /** For an action created in the admin screen (screen action), its basic info (name, where it attaches, result shape). Code actions have none. */
    custom?: CustomBase;
    /** Version of the edited value. 0 if never edited. */
    version: number;
    updatedAt: string | null;
    /** Names of values that differ from the defaults. */
    overridden: string[];
}
/** Reads the saved edited value. Drops values whose shape does not match (the definition changed and no longer fits). */
export declare const readOverride: (value: unknown) => AiActionOverride;
/**
 * `definition` is the code definition of the action (not given for a screen action): the defaults of its editable values go into the view.
 */
export declare const viewOf: (site: Pick<Site, "createTranslator">, action: ResolvedAiAction, row: {
    value: unknown;
    version: number;
    updatedAt: Date;
} | undefined, custom?: CustomValue, definition?: AiActionDefinition) => AiActionView;
/** Name (key) of a new, unsaved screen action. The server assigns a new name when saving. */
export declare const NEW_CUSTOM_KEY = "custom_new";
/** The shape of a new, unsaved screen action. The admin screen rebuilds it each time the basic info is chosen. */
export declare const draftCustomView: (site: Site, base: CustomBase) => AiActionView;
