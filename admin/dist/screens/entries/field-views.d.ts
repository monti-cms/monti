import { type FieldViewProps } from "../../admin-components.js";
/**
 * Screen of a view field (`fields.view({ view })`). The admin extension registers views through `fieldViews`.
 * If the name is not registered, nothing is rendered.
 */
export declare function FieldView({ view, ...props }: FieldViewProps & {
    view: string;
}): import("react").JSX.Element | null;
