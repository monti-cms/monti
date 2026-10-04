/**
 * Text color and text background color (`:color[text]{fg="#dc2626" fgDark="#f87171"}`). Stores hex values as light/dark theme pairs.
 * The picker list and value checks live in `./colors`. On the public page the site draws it with a `Color` component (`textColorProps`).
 */
export declare const colorBlock: {
    readonly name: "color";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "color";
    };
    readonly component: "Color";
    readonly attributes: {
        readonly fg: {
            readonly type: "string";
            readonly label: string;
        };
        readonly fgDark: {
            readonly type: "string";
            readonly label: string;
        };
        readonly bg: {
            readonly type: "string";
            readonly label: string;
        };
        readonly bgDark: {
            readonly type: "string";
            readonly label: string;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
};
