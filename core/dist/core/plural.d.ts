/** The plural of an identifier: only its last `-` or `_` separated word changes (`blog-post` -> `blog-posts`, `person` -> `people`). */
export declare function pluralizeId(id: string): string;
/** The public address a collection starts with, from its id: `post` -> `/posts/:slug`, `category` -> `/categories/:slug`. Init and the admin's new-collection dialog share it. */
export declare function defaultCollectionPath(id: string): string;
