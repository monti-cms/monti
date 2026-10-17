import type { Site } from "@monti-cms/core/site";
type ApiErrorSite = Pick<Site, "createTranslator">;
/** Text shown where the server answers that media storage is not configured. */
export declare const mediaNotConfiguredMessage: (site: ApiErrorSite) => string;
export type CmsIssue = {
    code?: string;
    message?: string;
    path?: string;
    /**
     * `blockId` names the block of the stored body the issue is in, so the visual editor can go to it. A text that could not be read
     * (`mdx_error`) has a `line` and `column` in that text instead.
     */
    position?: {
        line?: number;
        column?: number;
        blockId?: string;
    };
    /** What is wrong, in the admin language: the server writes it (`issueText` of `@monti-cms/core/site` for an issue the screen finds itself). */
    text: string;
    /** Where it is, in the admin language (a line and column of a body text, or the field path). */
    where?: string;
};
export declare function cmsApiIssues(payload: unknown): CmsIssue[];
/** The issue as one line: its text, and its place after it. */
export declare const issueLine: (issue: Pick<CmsIssue, "text" | "where">) => string;
export declare function cmsApiErrorMessage(site: ApiErrorSite, payload: unknown, fallback: string): string;
export {};
