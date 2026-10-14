import type { Site } from "@monti-cms/core/client";
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
};
export declare function cmsApiIssues(payload: unknown): CmsIssue[];
export declare function cmsIssueMessage(site: ApiErrorSite, issue: CmsIssue): string;
export declare function cmsApiErrorMessage(site: ApiErrorSite, payload: unknown, fallback: string): string;
export {};
