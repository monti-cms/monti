"use client";

import { type AdminComponents, adminApiUrl, type Site } from "@monti-cms/admin";
import { remoteTextChecker } from "@monti-cms/core";
import { readBareunOptions } from "./config";
import { BAREUN_CHECKER_ID, BAREUN_ROUTE } from "./options";

/** The Bareun spell checker, with the settings of the site's `bareun()` plugin. */
export const bareunComponents = (site: Site): AdminComponents => {
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
};
