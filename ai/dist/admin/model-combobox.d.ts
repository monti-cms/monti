import type { AiModelInfo } from "../connection.js";
/** Where to fetch the model list from. A saved connection by id; before saving, by URL and key. */
export type ModelSource = {
    providerId: string;
} | {
    url: string;
    apiKey?: string;
};
/**
 * Model list of a generation connection. A list fetched once is not fetched again for 10 minutes, and is reused after saving or reopening.
 * If there is no `source`, it is not fetched.
 */
export declare function useModelList(source: ModelSource | null): {
    models: AiModelInfo[] | null;
    loading: boolean;
    error: string | null;
};
/**
 * Model picker. Search the list and pick, or use a name that is not in the list exactly as typed.
 * Even without a list (judge model, or a URL that gives no list), you can type a name and pick it.
 */
export declare function ModelCombobox({ id, value, onChange, models, loading, error, placeholder, "aria-label": ariaLabel, }: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    models: AiModelInfo[] | null;
    loading?: boolean;
    error?: string | null;
    placeholder?: string;
    "aria-label"?: string;
}): import("react").JSX.Element;
