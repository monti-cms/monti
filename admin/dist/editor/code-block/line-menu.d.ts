import { type Site } from "@monti-cms/core/client";
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
/**
 * Line effects the menu lists for the picked lines [start, end): the offered ones (`site.OFFERED_LINE_EFFECTS`) plus any omitted one
 * that is already on those lines, so it stays visible and can be turned off. Definition order.
 */
export declare function lineEffectsToList(site: Site, lineEffects: readonly CodeLineEffect[], start: number, end: number): import("@monti-cms/core").CodeLineEffectDefinition[];
/** Whether the line menu has anything to show for the picked lines (an offered effect, folding, linking to body text, or an existing effect to turn off). */
export declare function lineMenuAvailable(site: Site, lineEffects: readonly CodeLineEffect[], start: number, end: number, canLink: boolean): boolean;
/** Menu that turns line effects (the effects and folds from the definition list) on and off for the lines picked in the line number gutter. Names and icons come from the effect definitions. */
export declare function LineMenu({ start, end, lineEffects, onChange, onClose, onLinkText, style }: LineMenuProps): import("react").JSX.Element;
export {};
