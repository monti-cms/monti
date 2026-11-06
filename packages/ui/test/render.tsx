import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach } from "vitest";
import { DEFAULT_UI_LABELS, UiLabelsProvider } from "../src/labels";
import { TooltipProvider } from "../src/tooltip";

const mounted: (() => void)[] = [];
afterEach(() => {
	for (const unmount of mounted.splice(0)) unmount();
});

/** Draws a part on the admin's root, with the providers the admin gives it, until the test ends. */
export function render(part: ReactNode) {
	const host = document.createElement("div");
	host.className = "monti-admin min-h-screen bg-monti-page p-monti-16 text-monti-default";
	document.body.append(host);
	const root = createRoot(host);
	root.render(
		<UiLabelsProvider labels={DEFAULT_UI_LABELS}>
			<TooltipProvider>{part}</TooltipProvider>
		</UiLabelsProvider>,
	);
	mounted.push(() => {
		root.unmount();
		host.remove();
	});
	return host;
}
