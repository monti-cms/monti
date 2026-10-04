/**
 * Public URL of one media item (shared image etc.). `null` if it is not ready or the deployment has no DB or storage.
 */
export declare function resolvePublicMediaUrl(mediaId: string): Promise<{
    url: string;
    width?: number;
    height?: number;
} | null>;
