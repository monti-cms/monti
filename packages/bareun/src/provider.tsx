"use client";

import { type AdminComponents, AdminComponentsProvider } from "@monti-cms/admin";
import { remoteTextChecker } from "@monti-cms/core";
import { adminApiUrl, useSite } from "@monti-cms/core/site";
import { type ReactNode, useMemo } from "react";
import { readBareunOptions } from "./config";
import { BAREUN_CHECKER_ID, BAREUN_ROUTE } from "./options";

/**
 * Adds the Bareun check button to the editor toolbar (results appear as wavy underlines and a results panel). The checker sends only paragraphs
 * to the site's server route (the server holds the key); its settings are those of the Bareun plugin in the site config.
 */
export function BareunProvider({ children }: { children: ReactNode }) {
	const site = useSite();
	const components = useMemo<AdminComponents>(() => {
		const options = readBareunOptions(site);
		return {
			textCheckers: [
				remoteTextChecker({
					id: BAREUN_CHECKER_ID,
					label: options.label,
					url: adminApiUrl(`/${BAREUN_ROUTE}`),
					locales: ["ko"],
					auto: options.auto,
					limits: options.limits,
				}),
			],
		};
	}, [site]);
	return <AdminComponentsProvider components={components}>{children}</AdminComponentsProvider>;
}
