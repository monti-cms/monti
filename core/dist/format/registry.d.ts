import { type CmsFormat, type FormatInfo } from "./types.js";
/** The formats of one CMS instance, by name. */
export interface FormatRegistry {
    get(name: string): CmsFormat | undefined;
    list(): readonly CmsFormat[];
    /** What the meta API reports. */
    info(): readonly FormatInfo[];
}
/** Builds a registry. Two formats with one name are an error (the same rule as colliding plugin routes), found when the instance loads its plugins. */
export declare function createFormatRegistry(formats: readonly CmsFormat[]): FormatRegistry;
/** A registry with no format. A CMS without a format plugin accepts documents only (`doc`), not text. */
export declare const NO_FORMATS: FormatRegistry;
