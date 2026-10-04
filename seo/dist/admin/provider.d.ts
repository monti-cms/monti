import { type CmsAdminComponents } from "@monti-cms/admin";
import type { ReactNode } from "react";
/** What the SEO extension adds to the admin UI: the search preview (view field) and the search title, description and hide inputs. */
export declare const SEO_ADMIN_COMPONENTS: CmsAdminComponents;
export declare function SeoAdminProvider({ children }: {
    readonly children: ReactNode;
}): import("react").JSX.Element;
