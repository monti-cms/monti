/**
 * Template menu at the end of the editor toolbar. Fetches the list on first open.
 * If the body is empty, inserts the chosen template right away; if there is body text, asks first whether to replace it.
 */
export declare function TemplateMenu({ currentMdx, disabled, onApply, }: {
    currentMdx: string;
    disabled: boolean;
    onApply: (mdx: string) => void;
}): import("react").JSX.Element;
