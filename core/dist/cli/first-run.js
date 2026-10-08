import { existsSync } from "node:fs";
import path from "node:path";
/**
 * The first-run check on a file the app owns, which `monti init` (to tailor what it prints) and `monti doctor` share: the root layout's `<html>` needs
 * `suppressHydrationWarning`, because the admin's theme provider puts its theme class and `color-scheme` on `<html>` before React hydrates.
 */
const ROOT_LAYOUT_NAMES = ["layout.tsx", "layout.jsx", "layout.ts", "layout.js"];
/** The root layout of the App Router (relative to `cwd`, with `/`), or `undefined` when there is none. */
export function findRootLayout(cwd) {
    const folders = existsSync(path.join(cwd, "src/app")) ? ["src/app"] : ["app", "src/app"];
    for (const folder of folders)
        for (const name of ROOT_LAYOUT_NAMES)
            if (existsSync(path.join(cwd, folder, name)))
                return `${folder}/${name}`;
    return undefined;
}
/** The opening `<html ...>` tag of a layout's text: where it starts, the attributes, and what closes it (`>` or `/>`). */
const HTML_TAG = /<html\b([^>]*?)(\s*)(\/?)>/;
/** Whether the `<html>` tag of a layout has `suppressHydrationWarning` (set, not `={false}`); `undefined` when the text has no `<html>` tag (a nested layout). */
export function hasSuppressHydrationWarning(text) {
    const match = HTML_TAG.exec(text);
    if (!match)
        return undefined;
    const attributes = match[1] ?? "";
    return /\bsuppressHydrationWarning\b(?!\s*=\s*\{\s*false\s*\})/.test(attributes);
}
