import { type ComponentProps } from "react";
/**
 * MDX source edit field. Text is written into an invisible input, and an overlaid layer in the same spot shows MDX syntax colors.
 * Colors are re-applied after typing pauses briefly. Until then only the changed line shows without color (so the text does not look misaligned).
 */
export declare function MdxSourceEditor({ value, className, ...props }: Omit<ComponentProps<"textarea">, "value"> & {
    value: string;
}): import("react").JSX.Element;
