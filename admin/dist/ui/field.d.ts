import { type VariantProps } from "class-variance-authority";
import { Label } from "./label.js";
declare function FormFieldSet({ className, ...props }: React.ComponentProps<"fieldset">): import("react").JSX.Element;
declare function FormFieldLegend({ className, variant, ...props }: React.ComponentProps<"legend"> & {
    variant?: "legend" | "label";
}): import("react").JSX.Element;
declare function FormFieldGroup({ className, ...props }: React.ComponentProps<"div">): import("react").JSX.Element;
declare const fieldVariants: (props?: ({
    orientation?: "horizontal" | "responsive" | "vertical" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
declare function FormField({ className, orientation, ...props }: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>): import("react").JSX.Element;
declare function FormFieldContent({ className, ...props }: React.ComponentProps<"div">): import("react").JSX.Element;
declare function FormFieldLabel({ className, ...props }: React.ComponentProps<typeof Label>): import("react").JSX.Element;
declare function FormFieldTitle({ className, ...props }: React.ComponentProps<"div">): import("react").JSX.Element;
declare function FormFieldDescription({ className, ...props }: React.ComponentProps<"p">): import("react").JSX.Element;
declare function FormFieldSeparator({ children, className, ...props }: React.ComponentProps<"div"> & {
    children?: React.ReactNode;
}): import("react").JSX.Element;
declare function FormFieldError({ className, children, errors, ...props }: React.ComponentProps<"div"> & {
    errors?: Array<{
        message?: string;
    } | undefined>;
}): import("react").JSX.Element | null;
export { FormField, FormFieldLabel, FormFieldDescription, FormFieldError, FormFieldGroup, FormFieldLegend, FormFieldSeparator, FormFieldSet, FormFieldContent, FormFieldTitle, };
