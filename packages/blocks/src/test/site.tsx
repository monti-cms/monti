import type { ReactNode } from "react";
import { SiteWrapper } from "../../../admin/src/test/site";
import { renderSite } from "./render-config";

/**
 * Gives the editor views under test the site they read their blocks, plugin options and admin language from (the blocks plugin site, `render-config.ts`),
 * and the query cache the editor looks server data up through.
 */
export const WithSite = ({ children }: { children: ReactNode }) => (
	<SiteWrapper site={renderSite}>{children}</SiteWrapper>
);
