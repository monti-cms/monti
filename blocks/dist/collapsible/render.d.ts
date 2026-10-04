import type { PropsWithChildren } from "react";
import { type BlockLabels } from "../shared/labels.js";
/** Collapsible. Expands when the title is clicked (it is a `<details>`, so no script is needed). With no title, the default text in the site language is used. */
export declare function Collapsible({ title, defaultOpen, labels, children, }: PropsWithChildren<{
    title?: string;
    defaultOpen?: boolean;
    labels?: BlockLabels;
}>): import("react").JSX.Element;
type ComponentProps = Parameters<typeof Collapsible>[0];
export default _default;
/** Public component for the collapsible (called by `@monti-cms/core/render`). */
declare function _default({ locale }: {
    locale?: string;
}): {
    Collapsible: (props: ComponentProps) => import("react").JSX.Element;
};
