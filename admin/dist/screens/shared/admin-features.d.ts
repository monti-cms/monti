import { type ReactNode } from "react";
/** Admin features toggled by server settings. The server layout decides and passes them down so the screen draws correctly from the start. */
export interface AdminFeatures {
    /** Whether there is a media storage (`storage` in `monti.config.ts`). */
    media: boolean;
}
export declare function AdminFeaturesProvider({ features, children }: {
    features: AdminFeatures;
    children: ReactNode;
}): import("react").JSX.Element;
export declare const useAdminFeatures: () => AdminFeatures;
