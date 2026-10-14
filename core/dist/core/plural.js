import pluralize from "pluralize";
import { patternUnder } from "./path-pattern.js";
/** The plural of an identifier: only its last `-` or `_` separated word changes (`blog-post` -> `blog-posts`, `person` -> `people`). */
export function pluralizeId(id) {
    const cut = Math.max(id.lastIndexOf("-"), id.lastIndexOf("_")) + 1;
    const last = id.slice(cut);
    return last === "" ? id : `${id.slice(0, cut)}${pluralize(last)}`;
}
/** The public address a collection starts with, from its id: `post` -> `/posts/:slug`, `category` -> `/categories/:slug`. Init and the admin's new-collection dialog share it. */
export function defaultCollectionPath(id) {
    return patternUnder(pluralizeId(id));
}
