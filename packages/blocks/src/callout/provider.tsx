"use client";

import { WarningAlt } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";
import { CalloutNodeView } from "./view";

/** The callout block's editing view and menu icon. */
export const calloutComponents: AdminComponents = {
	blockViews: { callout: CalloutNodeView },
	icons: { "warning--alt": WarningAlt },
};
