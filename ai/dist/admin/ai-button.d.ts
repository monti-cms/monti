import { type ReactNode } from "react";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry.js";
export interface AiButtonProps<K extends AiActionKey> {
    /** Action name to call (`aiPlugin({ actions })` in the site config). */
    action: K;
    /** Input read on click. Names and types come from the action definition. */
    input: () => AiActionInputOf<K>;
    /** Result. The receiver decides whether to change any value. */
    onResult: (result: AiActionResultOf<K>) => void;
    /** Button label. Defaults to the action name (its name in the admin AI screen). */
    children?: ReactNode;
    className?: string;
}
/**
 * AI button for custom screens (plugin screens, field inputs, etc.). Renders nothing if the action is off or has no connection.
 *
 * ```tsx
 * <AiButton action="summary" input={() => ({ title, body })} onResult={(result) => setSummary(result.text)} />
 * ```
 */
export declare function AiButton<K extends AiActionKey>({ action, input, onResult, children, className }: AiButtonProps<K>): import("react").JSX.Element | null;
