/**
 * Picker for collection icons. Shows a button with the current icon and opens a popover with
 * a searchable grid of curated CMS icons.
 */
export declare function IconPicker({ label, value, kind, onChange, }: {
    label: string;
    value: string | undefined;
    kind?: string;
    onChange: (value: string | undefined) => void;
}): import("react").JSX.Element;
