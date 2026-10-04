import type { CmsJsonValue } from "./types.js";
export declare const splitFrontmatter: (source: string) => {
    raw: string | null;
    body: string;
};
export declare const parseYamlMapping: (raw: string) => Record<string, CmsJsonValue>;
export declare const serializeFrontmatter: (data: Record<string, CmsJsonValue>) => string;
