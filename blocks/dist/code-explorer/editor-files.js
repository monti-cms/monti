import { parseMeta } from "@monti-cms/admin/blocks";
/** The code blocks among the children of a code explorer, in document order. Other children (a paragraph below the explorer's files) are not files. */
export function filesOf(children) {
    return children.flatMap((child) => {
        if (child.name !== "codeBlock")
            return [];
        const path = parseMeta(typeof child.values.meta === "string" ? child.values.meta : "").title.trim();
        return [{ index: child.index, path, folder: path.endsWith("/") }];
    });
}
/** A path starting with `stem` and ending with `suffix` that is not in `taken` yet: `src/new-file.ts`, `src/new-file-2.ts`, `src/new-file-3.ts`… */
export function uniquePath(taken, stem, suffix) {
    let path = `${stem}${suffix}`;
    for (let number = 2; taken.includes(path); number += 1)
        path = `${stem}-${number}${suffix}`;
    return path;
}
