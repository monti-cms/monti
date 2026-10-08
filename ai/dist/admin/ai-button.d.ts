import { type AnyCmsConfig } from "@monti-cms/core/client";
import { type ReactNode } from "react";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry.js";
export interface AiButtonProps<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig> {
    /** Action name to call (`aiPlugin({ actions })` in the site config). */
    action: K;
    /** Input read on click. Names and types come from the action definition. */
    input: () => AiActionInputOf<K, Config>;
    /** Result. The receiver decides whether to change any value. */
    onResult: (result: AiActionResultOf<K, Config>) => void;
    /** Button label. Defaults to the action name (its name in the admin AI screen). */
    children?: ReactNode;
    className?: string;
}
/**
 * AI button for custom screens (plugin screens, field inputs, etc.). Renders nothing if the action is off or has no connection. `aiClient<typeof config>()` gives the
 * button with action names, inputs and results typed by the config.
 *
 * ```tsx
 * <AiButton action="summary" input={() => ({ title, body })} onResult={(result) => setSummary(result.text)} />
 * ```
 */
export declare function AiButton<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig>({ action, input, onResult, children, className, }: AiButtonProps<K, Config>): import("react").JSX.Element | null;
