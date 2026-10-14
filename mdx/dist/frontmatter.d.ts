import type { CmsJsonValue } from "@monti-cms/core/document";
export declare const splitFrontmatter: (source: string) => {
    raw: string | null;
    body: string;
};
/** Reads the YAML of a front matter block as a mapping. Throws on invalid YAML; anything that is not a mapping reads as no data. */
export declare const parseYamlMapping: (raw: string) => Record<string, CmsJsonValue>;
export declare const serializeFrontmatter: (data: Record<string, CmsJsonValue>) => string;
