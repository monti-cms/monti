"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { cmsApiUrl, remoteTextChecker } from "@monti-cms/core/client";
import { readBareunOptions } from "./config.js";
import { BAREUN_CHECKER_ID, BAREUN_ROUTE } from "./options.js";
const options = readBareunOptions();
/** The Bareun checker. The browser sends only paragraphs to the site's server route (the server holds the key). */
export const bareunChecker = remoteTextChecker({
    id: BAREUN_CHECKER_ID,
    label: options.label,
    url: cmsApiUrl(`/${BAREUN_ROUTE}`),
    locales: ["ko"],
    auto: options.auto,
    limits: options.limits,
});
const components = { textCheckers: [bareunChecker] };
/** Adds the Bareun check button to the editor toolbar (results appear as wavy underlines and a results panel). */
export function BareunProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
