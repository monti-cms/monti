import type { PropsWithChildren } from "react";
import { type BlockLabels } from "../shared/labels.js";
/** Callout. Wraps the title and body in a box with an accent color per `variant`. An unknown variant falls back to note; a missing title falls back to the variant name. */
export declare function Callout({ variant, title, labels, children, }: PropsWithChildren<{
    variant?: string;
    title?: string;
    labels?: BlockLabels;
}>): import("react").JSX.Element;
type CalloutProps = Parameters<typeof Callout>[0];
export default _default;
/** Public component for the callout (called by `@monti-cms/core/render`). */
declare function _default({ locale }: {
    locale?: string;
}): {
    Callout: (props: CalloutProps) => import("react").JSX.Element;
};
