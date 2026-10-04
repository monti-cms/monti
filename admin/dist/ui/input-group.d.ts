import { type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Button } from "./button.js";
declare function InputGroup({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare const inputGroupAddonVariants: (props?: ({
    align?: "block-end" | "block-start" | "inline-end" | "inline-start" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
declare function InputGroupAddon({ className, align, ...props }: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>): React.JSX.Element;
declare const inputGroupButtonVariants: (props?: ({
    size?: "icon-sm" | "icon-xs" | "sm" | "xs" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
declare function InputGroupButton({ className, type, variant, size, ...props }: Omit<React.ComponentProps<typeof Button>, "size" | "type"> & VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset";
}): React.JSX.Element;
declare function InputGroupText({ className, ...props }: React.ComponentProps<"span">): React.JSX.Element;
declare function InputGroupInput({ className, ...props }: React.ComponentProps<"input">): React.JSX.Element;
declare function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">): React.JSX.Element;
export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea };
