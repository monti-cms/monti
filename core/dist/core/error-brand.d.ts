/**
 * Makes `instanceof` recognize an error class's instances from any copy of this package. A Next app bundles `@monti-cms/core` into its routes, while a
 * module loaded later by `import()` (the Postgres store) can come from the installed copy. Two `CmsError` classes then exist, and a plain prototype
 * check misses the store's errors: its `not_found` or `invalid_input` reached the client as an unknown 500. The brand is a global symbol
 * (`Symbol.for`), the same in every copy, set on the class's prototype so subclasses carry it too. A subclass that is not branded itself keeps the
 * ordinary prototype check.
 */
export declare function brandErrorClass(cls: abstract new (...args: never[]) => Error, name: string): void;
