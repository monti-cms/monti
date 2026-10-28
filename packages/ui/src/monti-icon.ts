import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

/**
 * An icon as the design system takes one: a React component that draws an `<svg>` and accepts `size`, `className` and the usual svg and `aria-*`
 * props. The IBM Carbon icons (`@carbon/icons-react`) are this, and so is `Spark`; give one wherever an `icon` is asked for.
 * It draws at 16px unless a parent sizes it with a class.
 */
export type MontiIcon = ForwardRefExoticComponent<
	Omit<SVGProps<SVGSVGElement>, "ref" | "size"> & { size?: number | string } & RefAttributes<SVGSVGElement>
>;
