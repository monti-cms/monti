"use client";
import { MessageSquareWarning } from "lucide-react";
import { CalloutNodeView } from "./view.js";
/** The callout block's editing view and menu icon. */
export const calloutComponents = {
    blockViews: { callout: CalloutNodeView },
    icons: { "message-square-warning": MessageSquareWarning },
};
