/**
 * Code ref (`:code-ref[text]{to="c1"}`). Links body text to a line of a code block in the same post. `to` is a code block line anchor
 * (code fence comment `// @line anchor {2-4} id="c1"`, a core code block feature). On the public page, hovering or pressing the text
 * highlights that line (the site's `CodeRef` component).
 *
 * `to` carries `codeAnchor`, so the admin editor's code block uses this mark for line picking, link guidance, and hover line highlighting.
 */
export declare const codeRefBlock: {
    readonly name: "code-ref";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "code-ref";
    };
    readonly component: "CodeRef";
    readonly attributes: {
        readonly to: {
            readonly type: "string";
            readonly label: string;
            readonly required: true;
            readonly codeAnchor: true;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
};
