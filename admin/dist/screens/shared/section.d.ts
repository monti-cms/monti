import type { ReactNode } from "react";
/**
 * One section of a settings screen: the title and a one-line description in a column on the left, the content in a card on the right (stacked on a narrow
 * screen). A section is page > section > rows: the card holds fields or one list, never another bordered box.
 */
export declare function Section({ title, description, note, children, wide, card, className, testId, }: {
    title: ReactNode;
    description?: ReactNode;
    /** A quieter line under the description (what cannot be changed, a warning about the file). */
    note?: ReactNode;
    children: ReactNode;
    /** The left column is 260px (a page of its own) instead of 220px (inside a collection). */
    wide?: boolean;
    /** `false` when the content is a card of its own (a list of rows with its own header). */
    card?: boolean;
    className?: string;
    testId?: string;
}): import("react").JSX.Element;
