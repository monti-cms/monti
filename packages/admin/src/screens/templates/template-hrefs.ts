import type { Site } from "@monti-cms/core/site";

type SiteForHrefs = Pick<Site, "adminHref">;

/** The list of templates: the first tab of the tools page. */
export const templatesHref = (site: SiteForHrefs): string => site.adminHref("/tools/templates");

/** The page that starts a new template. */
export const newTemplateHref = (site: SiteForHrefs): string => site.adminHref("/templates/new");

/** The page of one template. */
export const editTemplateHref = (site: SiteForHrefs, id: string): string =>
	site.adminHref(`/templates/${encodeURIComponent(id)}/edit`);
