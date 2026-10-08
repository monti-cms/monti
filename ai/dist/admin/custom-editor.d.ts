import { type Site } from "@monti-cms/core/client";
import { type CustomBase } from "../custom.js";
/** Picking the basic info of a screen action: name, attach target, result shape. */
type Option = {
    value: string;
    label: string;
};
/** Select field of the AI screen. The closed field shows the name, not the value. */
export declare function OptionSelect({ id, value, options, onChange, disabled, className, "aria-label": ariaLabel, }: {
    id?: string;
    value: string;
    options: readonly Option[];
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
}): import("react").JSX.Element;
export declare const NEW_CUSTOM_BASE: (site: Site) => CustomBase;
/** Basic info inputs. Changing the attach target turns result shapes and modes that cannot be used there into the first value. */
export declare function CustomBaseFields({ base, onChange }: {
    base: CustomBase;
    onChange: (base: CustomBase) => void;
}): import("react").JSX.Element;
export {};
