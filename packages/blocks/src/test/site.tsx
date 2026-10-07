import { SiteProvider } from "@monti-cms/core/client";
import type { ReactNode } from "react";
import { renderSite } from "./render-config";

/** Gives the editor views under test the site they read their blocks, plugin options and admin language from (the blocks plugin site, `render-config.ts`). */
export const WithSite = ({ children }: { children: ReactNode }) => (
	<SiteProvider site={renderSite}>{children}</SiteProvider>
);
