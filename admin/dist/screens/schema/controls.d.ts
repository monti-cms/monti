import type { ConfigIssue } from "@monti-cms/core/site";
import { type ReactNode } from "react";
import { type CONTROL_WIDTH } from "../shared/labeled.js";
import { type Obj } from "./schema-model.js";
/** What every editor of the screen reads: whether the screen is read-only, the vocabulary of body lists, and the problems of the last check. */
export interface SchemaEditContext {
    readonly disabled: boolean;
    readonly vocabulary: {
        readonly blocks: readonly string[];
        readonly marks: readonly string[];
    };
    readonly issues: readonly ConfigIssue[];
    readonly collectionNames: readonly string[];
    /** Collections defined in code: the preview keeps them next to the file's. */
    readonly codeCollections: readonly string[];
    /** The file as edited, for editors that look at another collection (a relation's target, a backlink's relation). */
    readonly file: Obj;
}
export declare const SchemaEditProvider: import("react").Provider<SchemaEditContext>;
export declare const useSchemaEdit: () => SchemaEditContext;
/** The problems of the last check at `path` or below it. */
export declare function useIssuesUnder(path: string, exclude?: string): readonly ConfigIssue[];
export declare function IssueList({ issues }: {
    issues: readonly ConfigIssue[];
}): import("react").JSX.Element | null;
export declare function TextInput({ label, value, onChange, placeholder, description, hint, type, className, optional, disabled: customDisabled, }: {
    label: string;
    value: string | number | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    description?: ReactNode;
    hint?: ReactNode;
    type?: "text" | "number";
    className?: string;
    /** Marks the field as optional with a muted "optional" next to the label (the form marks what is optional, not what is required). */
    optional?: boolean;
    disabled?: boolean;
}): import("react").JSX.Element;
/** A text value that is `undefined` when empty (an optional property of the file). */
export declare const orUndefined: (value: string) => string | undefined;
export declare const countOrUndefined: (value: string) => number | undefined;
export declare function FlagSwitch({ label, checked, onChange, description, hint, className, locked, }: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    description?: ReactNode;
    hint?: ReactNode;
    className?: string;
    /** The switch cannot be changed here (the value is fixed by something else): shown as it is, disabled. */
    locked?: boolean;
}): import("react").JSX.Element;
/** A few exclusive choices side by side in one rounded strip (a segmented control). */
export declare function Segmented({ label, value, items, onChange, description, hint, }: {
    label: string;
    value: string;
    items: readonly PickItem[];
    onChange: (value: string) => void;
    description?: ReactNode;
    hint?: ReactNode;
}): import("react").JSX.Element;
export interface PickItem {
    readonly value: string;
    readonly label: string;
    /** A muted line under the label in the list of choices (the closed select shows the label only). */
    readonly description?: string;
}
export declare function Pick({ label, value, items, onChange, description, hint, className, disabled: customDisabled, control, size, }: {
    label: string;
    value: string;
    items: readonly PickItem[];
    onChange: (value: string) => void;
    description?: ReactNode;
    hint?: ReactNode;
    className?: string;
    disabled?: boolean;
    control?: keyof typeof CONTROL_WIDTH;
    size?: "sm" | "default";
}): import("react").JSX.Element;
/**
 * An input for a name (a field, an option, a collection): the change is taken when the writer leaves the input or presses Enter, and a name that cannot be used
 * is refused with the reason, so a half-typed name never renames anything.
 */
export declare function NameInput({ label, value, taken, onCommit, disabled: forcedDisabled, className, description, hint, }: {
    label: string;
    value: string;
    /** The other names it must differ from. */
    taken: readonly string[];
    onCommit: (name: string) => void;
    disabled?: boolean;
    className?: string;
    description?: ReactNode;
    hint?: ReactNode;
}): import("react").JSX.Element;
/** Up, down and remove buttons of one row of a list. */
export declare function RowActions({ index, count, onMove, onRemove, name, removeBlocked, }: {
    index: number;
    count: number;
    onMove: (delta: number) => void;
    onRemove: () => void;
    name: string;
    /** Why the row cannot be removed: the remove button is disabled and the reason is its tooltip. */
    removeBlocked?: string;
}): import("react").JSX.Element;
export declare function AddButton({ children, onClick, disabled: off, }: {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}): import("react").JSX.Element;
