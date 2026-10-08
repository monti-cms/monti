import type { Site } from "@monti-cms/core/client";
import { type AiActionDefinition, type AiActionOverride, type ResolvedAiAction } from "./action.js";
import { type AiActionView } from "./action-view.js";
import { type AiSharedStore } from "./shared.js";
/**
 * Handles action definitions (config) and edited values (DB) together. Used by the admin AI screen and the run API.
 * Edited values under names missing from the definition are ignored (when an action was removed from the config).
 */
type Row = {
    key: string;
    value: unknown;
    version: number;
    updatedAt: Date;
};
export type { AiActionView } from "./action-view.js";
export interface AiActionsStore extends Pick<AiSharedStore, "getAiSettings"> {
    listAiActionOverrides(): Promise<Row[]>;
    saveAiActionOverride(params: {
        key: string;
        expectedVersion: number;
        value: unknown;
    }): Promise<Row>;
    /** Custom actions (created in the admin UI). */
    listAiCustomActions(): Promise<Row[]>;
    saveAiCustomAction(params: {
        key: string;
        expectedVersion: number;
        value: unknown;
    }): Promise<Row>;
    deleteAiCustomAction(params: {
        key: string;
        expectedVersion: number;
    }): Promise<void>;
}
/** One action (with edited values applied). Custom actions have the same shape. */
export declare function getAction(site: Site, store: AiActionsStore, key: string): Promise<ResolvedAiAction>;
/** All coded actions in config order, then custom actions in creation order. */
export declare function listActions(site: Site, store: AiActionsStore): Promise<AiActionView[]>;
/**
 * Builds an action to test or save with editable values. `{{name}}` in the prompt only accepts locale inputs and shared texts (`sharedKeys`: the config's texts and
 * those added in the admin UI). Values that cannot be edited (name, result shape, etc.) are ignored if sent.
 */
export declare function actionWithEdits(site: Site, key: string, edited: unknown, definition?: AiActionDefinition, sharedKeys?: readonly string[]): ResolvedAiAction;
/**
 * Action to test with unsaved edited values (the AI screen's `Test`). A custom action is built from the base info (`base`) if given (e.g. a new, still
 * unsaved action), otherwise from the saved base info.
 */
export declare function actionWithDraft(site: Site, store: AiActionsStore, key: string, edited: unknown, baseInput?: unknown): Promise<ResolvedAiAction>;
/** Creates a custom action. Takes the base info and the edited values (connection, model, prompt, checks, etc.) at once. */
export declare function createCustomAction(site: Site, store: AiActionsStore, baseInput: unknown, edited?: unknown): Promise<AiActionView>;
/** Deletes a custom action. */
export declare function deleteCustomAction(site: Site, store: AiActionsStore, key: string, expectedVersion: number): Promise<void>;
/**
 * Saves edited values. Values equal to the default are not stored.
 * For a custom action, the base info (`base`: name, attach point, result shape) can be edited too.
 */
export declare function updateAction(site: Site, store: AiActionsStore, key: string, expectedVersion: number, edited: unknown, baseInput?: unknown): Promise<AiActionView>;
/** Resets to defaults. The enabled state keeps its current value. A custom action has no default to reset to. */
export declare function resetAction(site: Site, store: AiActionsStore, key: string, expectedVersion: number): Promise<AiActionView>;
/**
 * Moves the stored values of the legacy AI action table (`ai_features`) into per-action edited values, keeping only values that differ from the definition.
 * Names missing from the definition (actions removed from the config, a previously deleted `mediaAlt`, etc.) give `null`.
 * The legacy `send` content list (`inputs`) becomes `send`, and inputs missing from the definition (e.g. `tags`) are dropped.
 */
export declare function legacyFeatureOverride(site: Site, key: string, spec: unknown): AiActionOverride | null;
