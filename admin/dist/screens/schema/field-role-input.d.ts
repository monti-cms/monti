import { type FieldKindName, type Obj } from "./schema-model.js";
export declare function FieldRolePicker({ role, kind, isTitle, disabled, onChange, }: {
    role: string | undefined;
    kind: FieldKindName;
    isTitle?: boolean;
    disabled?: boolean;
    onChange: (role: string | undefined) => void;
}): import("react").JSX.Element;
export declare function InputOptionsEditor({ value, onChange, }: {
    value: unknown;
    onChange: (value: Obj | undefined) => void;
}): import("react").JSX.Element;
export declare function FieldCustomInputPicker({ value, options, disabled, onChangeInput, onChangeOptions, }: {
    value: string | undefined;
    options: unknown;
    disabled?: boolean;
    onChangeInput: (input: string | undefined) => void;
    onChangeOptions: (options: Obj | undefined) => void;
}): import("react").JSX.Element;
