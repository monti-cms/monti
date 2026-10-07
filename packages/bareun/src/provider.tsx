"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { cmsApiUrl, remoteTextChecker, useSite } from "@monti-cms/core/client";
import { type ReactNode, useMemo } from "react";
import { readBareunOptions } from "./config";
import { BAREUN_CHECKER_ID, BAREUN_ROUTE } from "./options";

/**
 * Adds the Bareun check button to the editor toolbar (results appear as wavy underlines and a results panel). The checker sends only paragraphs
 * to the site's server route (the server holds the key); its settings are those of the Bareun plugin in the site config.
 */
export function BareunProvider({ children }: { children: ReactNode }) {
	const site = useSite();
	const components = useMemo<CmsAdminComponents>(() => {
		const options = readBareunOptions(site);
		return {
			textCheckers: [
				remoteTextChecker({
					id: BAREUN_CHECKER_ID,
					label: options.label,
					url: cmsApiUrl(`/${BAREUN_ROUTE}`),
					locales: ["ko"],
					auto: options.auto,
					limits: options.limits,
				}),
			],
		};
	}, [site]);
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
