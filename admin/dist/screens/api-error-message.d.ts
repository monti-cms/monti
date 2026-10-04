export declare const MEDIA_NOT_CONFIGURED: string;
export type CmsIssue = {
    code?: string;
    message?: string;
    path?: string;
    position?: {
        line: number;
        column: number;
    };
};
export declare function cmsApiIssues(payload: unknown): CmsIssue[];
export declare function cmsIssueMessage(issue: CmsIssue): string;
export declare function cmsApiErrorMessage(payload: unknown, fallback: string): string;
