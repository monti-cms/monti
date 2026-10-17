"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { MessageSquareWarning } from "lucide-react";
import { CalloutNodeView } from "./view";

/** The callout block's editing view and menu icon. */
export const calloutComponents: AdminComponents = {
	blockViews: { callout: CalloutNodeView },
	icons: { "message-square-warning": MessageSquareWarning },
};
