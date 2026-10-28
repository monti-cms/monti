"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { CalloutNodeView } from "./view";

/** The callout block's editing view. */
export const calloutComponents: AdminComponents = {
	blockViews: { callout: CalloutNodeView },
};
