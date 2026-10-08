import type { ComponentProps } from "react";
import { Button } from "./button.js";
/**
 * Toggle button for light and dark themes. On server render the current theme is unknown, and the button rendered on the server
 * gave the elements after it automatic IDs (useId) different from the browser's (hydration mismatch). So until hydration
 * finishes it renders a same-size placeholder, and afterwards the real button.
 */
export declare function ThemeToggle({ labels, ...props }: Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
    /** Button name. A public site passes a message in its own display language (it then needs no site). */
    labels?: {
        toLight: string;
        toDark: string;
    };
}): import("react").JSX.Element;
