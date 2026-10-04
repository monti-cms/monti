import { type CodeLineEffect } from "@monti-cms/core/code-block";
import { type CSSProperties } from "react";
interface LineMenuProps {
    /** The picked lines [start, end). */
    start: number;
    end: number;
    lineEffects: CodeLineEffect[];
    onChange: (next: CodeLineEffect[]) => void;
    onClose: () => void;
    /** Starts linking this line to body text (lets the user drag-select the body). */
    onLinkText?: () => void;
    style?: CSSProperties;
}
/** Menu that turns line effects (the effects and folds from the definition list) on and off for the lines picked in the line number gutter. Names and icons come from the effect definitions. */
export declare function LineMenu({ start, end, lineEffects, onChange, onClose, onLinkText, style }: LineMenuProps): import("react").JSX.Element;
export {};
