import type { AiInputKind } from "../action.js";
import type { AiActionView } from "../actions.js";
import type { AiRunEnv } from "./ai-slot-provider.js";
/**
 * Sample input for the AI screen's Test. Shows one field of the matching kind for each input in the action definition (input names are not shown).
 * - text, MDX, code: multi-line field; current value: single-line field; image: media ID or site path; language: language picker from the site config
 */
export interface SampleField {
    readonly name: string;
    readonly kind: AiInputKind;
    readonly label: string;
    readonly required: boolean;
}
type SampleFeature = Pick<AiActionView, "input" | "engine" | "attach">;
/** Fields shown in the test: inputs to send (including required ones) and language inputs (which go into the instructions). The judge mode does not read images. */
export declare function sampleFields(feature: SampleFeature, send: readonly string[]): SampleField[];
/** Initial value of a field. The first language input is the default language; the next language input is the first non-default language (source -> target). */
export declare function sampleDefaults(feature: Pick<AiActionView, "input">): Record<string, string>;
/** Current value of a field. If never edited, it is the initial value. */
export declare const sampleValue: (values: Readonly<Record<string, string>>, defaults: Readonly<Record<string, string>>, name: string) => string;
/** Whether any required field is empty (if so, it does not run). */
export declare const missingRequired: (fields: readonly SampleField[], values: Readonly<Record<string, string>>, defaults: Readonly<Record<string, string>>) => boolean;
/**
 * Builds the run input and common information from the test values. Empty fields are not sent. A field-slot action runs with the first collection, and a translation-slot action with
 * the target language (`to`, an input the translation slot provides).
 */
export declare function sampleRun(feature: SampleFeature, fields: readonly SampleField[], values: Readonly<Record<string, string>>, defaults?: Readonly<Record<string, string>>): {
    input: Record<string, unknown>;
    env: AiRunEnv;
};
/** Test fields. A field's name (aria-label, placeholder) is the input's label. */
export declare function SampleInputs({ fields, values, defaults, onChange, }: {
    fields: readonly SampleField[];
    values: Readonly<Record<string, string>>;
    defaults: Readonly<Record<string, string>>;
    onChange: (name: string, value: string) => void;
}): import("react").JSX.Element[];
export {};
