import type { SchemaIssue } from "@monti-cms/core/schema-edit";
import { type ReactNode } from "react";
import { type Obj } from "./schema-model.js";
/** What every editor of the screen reads: whether the screen is read-only, the vocabulary of body lists, and the problems of the last check. */
export interface SchemaEditContext {
    readonly disabled: boolean;
    readonly vocabulary: {
        readonly blocks: readonly string[];
        readonly marks: readonly string[];
    };
    readonly issues: readonly SchemaIssue[];
    readonly collectionNames: readonly string[];
    /** The file as edited, for editors that look at another collection (a relation's target, a backlink's relation). */
    readonly file: Obj;
}
export declare const SchemaEditProvider: import("react").Provider<SchemaEditContext>;
export declare const useSchemaEdit: () => SchemaEditContext;
/** The problems of the last check at `path` or below it. */
export declare function useIssuesUnder(path: string, exclude?: string): readonly SchemaIssue[];
export declare function IssueList({ issues }: {
    issues: readonly SchemaIssue[];
}): import("react").JSX.Element | null;
export declare function Labeled({ label, hint, children, htmlFor, className, }: {
    label: ReactNode;
    hint?: ReactNode;
    htmlFor?: string;
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
export declare function TextInput({ label, value, onChange, placeholder, hint, type, className, }: {
    label: string;
    value: string | number | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    hint?: ReactNode;
    type?: "text" | "number";
    className?: string;
}): import("react").JSX.Element;
/** A text value that is `undefined` when empty (an optional property of the file). */
export declare const orUndefined: (value: string) => string | undefined;
export declare const countOrUndefined: (value: string) => number | undefined;
export declare function FlagSwitch({ label, checked, onChange, hint, }: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    hint?: ReactNode;
}): import("react").JSX.Element;
export interface PickItem {
    readonly value: string;
    readonly label: string;
}
export declare function Pick({ label, value, items, onChange, hint, className, }: {
    label: string;
    value: string;
    items: readonly PickItem[];
    onChange: (value: string) => void;
    hint?: ReactNode;
    className?: string;
}): import("react").JSX.Element;
/**
 * An input for a name (a field, an option, a collection): the change is taken when the writer leaves the input or presses Enter, and a name that cannot be used
 * is refused with the reason, so a half-typed name never renames anything.
 */
export declare function NameInput({ label, value, taken, onCommit, disabled: forcedDisabled, className, hint, }: {
    label: string;
    value: string;
    /** The other names it must differ from. */
    taken: readonly string[];
    onCommit: (name: string) => void;
    disabled?: boolean;
    className?: string;
    hint?: ReactNode;
}): import("react").JSX.Element;
/** Up, down and remove buttons of one row of a list. */
export declare function RowActions({ index, count, onMove, onRemove, name, }: {
    index: number;
    count: number;
    onMove: (delta: number) => void;
    onRemove: () => void;
    name: string;
}): import("react").JSX.Element;
/** An ordered list of names picked from `options`: add from the options not in the list yet, move, remove. Used for layout groups and list columns. */
export declare function OrderedNames({ label, names, options, onChange, nameOf, }: {
    label: string;
    names: readonly string[];
    options: readonly string[];
    onChange: (names: string[]) => void;
    nameOf?: (name: string) => string;
}): import("react").JSX.Element;
export declare function AddButton({ children, onClick, disabled: off, }: {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}): import("react").JSX.Element;
