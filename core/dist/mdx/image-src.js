/**
 * Address resolution rules for `::image`.
 *
 * The site's public image renderer and the pre-publish check use **the same function** —
 * copying the allow rules into two places leads to fixing only one of them.
 *
 * **Resolution failure contract:** the public page keeps a neutral placeholder and the caption, and does not apply `width` or `align`.
 * The internal failure reason is not shown on the public page. It is not replaced with the `alt` text — that would silently change the document's meaning, and decorative images have no alt to substitute.
 *
 * Non-blocking warnings cover only **3 cases that actually occur with valid data**:
 * (1) a media row exists but is not `ready`, (2) it is `ready` but the storage object cannot be resolved, (3) an external `src` violates the allow rules.
 * A missing media row is already blocked by the FK/CHECK on `entry_references` and by the publish check, so it is not a warning case.
 */
/** Lets only absolute http(s) or site-relative paths through. Executable URLs (`javascript:`, `data:`) are rejected. */
export const resolveImageUrl = (src) => {
    const trimmed = src?.trim();
    if (!trimmed)
        return null;
    // `//host/path` is a protocol-relative address, so it is not treated as a site-relative path.
    if (trimmed.startsWith("//"))
        return { failure: "rejected" };
    if (/^https?:\/\//i.test(trimmed))
        return { url: trimmed };
    if (trimmed.startsWith("/"))
        return { url: trimmed };
    return { failure: "rejected" };
};
/** Whether an external `src` passes the allow rules. Used when the pre-publish check builds warnings. */
export const isAllowedImageSrc = (src) => {
    const resolved = resolveImageUrl(src);
    return resolved !== null && "url" in resolved;
};
