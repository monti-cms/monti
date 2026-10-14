/**
 * Column width resize handle. Drag the header's right edge, or focus it and press ←/→ to change by 16px. Pressing twice resets to the default width.
 */
export declare function ColumnResizeHandle({ label, width, resizing, onStart, onNudge, onReset, }: {
    label: string;
    width: number;
    resizing: boolean;
    onStart: (event: unknown) => void;
    onNudge: (delta: number) => void;
    onReset: () => void;
}): import("react").JSX.Element;
