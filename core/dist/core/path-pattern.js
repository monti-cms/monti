/**
 * A collection's public address shape (`path`, e.g. `/posts/:slug`): the one place that knows how it is written, checked, filled in with a slug, matched against a
 * path and compared with another shape. The config check, the body links, the new-collection forms of the CLI and the admin all use it, so they accept the same shapes.
 */
/** Where the slug goes in a path pattern. */
export const SLUG_TOKEN = ":slug";
/** Why a path pattern cannot be used, or `undefined` when it can: it starts with `/`, holds `:slug` once and nothing else that reads as a parameter, query or fragment. */
export function checkPathPattern(path) {
    if (!path.startsWith("/"))
        return { code: "slash", message: `must start with "/" (got "${path}")` };
    if (path.split(SLUG_TOKEN).length !== 2 || /:(?!slug)/.test(path) || /[?#]/.test(path)) {
        return {
            code: "slug",
            message: `must contain "${SLUG_TOKEN}" exactly once, with no other ":", "?" or "#" (got "${path}")`,
        };
    }
    return undefined;
}
/** The text before and after the slug (`/posts/:slug.html` -> `["/posts/", ".html"]`). */
export function splitPattern(path) {
    const [prefix = "", suffix = ""] = path.split(SLUG_TOKEN);
    return [prefix, suffix];
}
/** The pattern of the entries that live in a folder of the site (`blog` -> `/blog/:slug`). */
export const patternUnder = (folder) => `/${folder.replace(/^\/+|\/+$/g, "")}/${SLUG_TOKEN}`;
/** The path of an entry: the pattern with the slug in it. */
export function fillPattern(path, slug) {
    const [prefix, suffix] = splitPattern(path);
    return `${prefix}${slug}${suffix}`;
}
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The slug (still encoded) a pathname has in this pattern, or `null` when it is not one of its paths. A trailing `/` is allowed. */
export function matchPattern(path, pathname) {
    const [prefix, suffix] = splitPattern(path);
    const pattern = new RegExp(`^${escapeRegExp(prefix)}([^/]+)${escapeRegExp(suffix.replace(/\/$/, ""))}\\/?$`);
    return pattern.exec(pathname)?.[1] ?? null;
}
/**
 * Can two shapes produce the same URL? If so, a body link cannot tell which collection it points to.
 * A slug lives within a single `/`-free segment, so the shapes collide when the segment counts match and every segment can match:
 * literal segments must be equal; a slug segment (`prefix:slugsuffix`) matches a literal segment if the literal starts and ends with that prefix and suffix (the slug needs at least one character);
 * two slug segments can match if one prefix starts with the other and one suffix ends with the other.
 */
export function patternsOverlap(a, b) {
    const segments = (path) => path.replace(/\/+$/, "").split("/");
    const left = segments(a);
    const right = segments(b);
    if (left.length !== right.length)
        return false;
    return left.every((x, index) => {
        const y = right[index] ?? "";
        const xs = x.split(SLUG_TOKEN);
        const ys = y.split(SLUG_TOKEN);
        if (xs.length === 1 && ys.length === 1)
            return x === y;
        if (xs.length === 1 || ys.length === 1) {
            const literal = xs.length === 1 ? x : y;
            const [prefix = "", suffix = ""] = xs.length === 1 ? ys : xs;
            return literal.length > prefix.length + suffix.length && literal.startsWith(prefix) && literal.endsWith(suffix);
        }
        const [xp = "", xsuf = ""] = xs;
        const [yp = "", ysuf = ""] = ys;
        return (xp.startsWith(yp) || yp.startsWith(xp)) && (xsuf.endsWith(ysuf) || ysuf.endsWith(xsuf));
    });
}
