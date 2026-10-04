import { type VariantProps } from "class-variance-authority";
import type * as React from "react";
/**
 * Alert box for the admin UI. `default` is for notices, `danger` for errors such as a load failure.
 * The look of body blocks (callouts, etc.) is decided by each block separately.
 */
export declare const alertVariants: (props?: ({
    layout?: "grid" | "stack" | null | undefined;
    variant?: "danger" | "default" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
declare function Alert({ className, layout, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>): React.JSX.Element;
declare function AlertTitle({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function AlertDescription({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
export { Alert, AlertTitle, AlertDescription };
