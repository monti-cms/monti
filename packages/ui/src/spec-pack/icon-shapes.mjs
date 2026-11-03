// Monti's icon shapes, for reading a board's icons by name: each Carbon icon of the design system's icon list (`../icons.ts`, `iconsByName`) drawn once,
// its shape as a key. A board's icons are copies of Carbon's, so the same shape names the same icon. `pnpm gen:screen-catalog` writes
// `icon-shapes.generated.json` with this (`pack.mjs`, `generate`); the HTML board file looks a board's `<svg>` up in it.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { shapeKey } from "./icon-key.js";

const require = createRequire(import.meta.url);

/** `{ shape key: icon name }` for every Carbon icon in the icon list. */
export function iconShapes() {
	const carbon = require("@carbon/icons-react");
	const { createElement } = require("react");
	const { renderToStaticMarkup } = require("react-dom/server");
	const list = readFileSync(new URL("../icons.ts", import.meta.url), "utf8");
	const body = list.slice(list.indexOf("export const iconsByName"));
	const shapes = {};
	for (const [, quoted, bare, component] of body.matchAll(/^\s*(?:"([^"]+)"|([\w-]+)):\s*(\w+),$/gm)) {
		const icon = carbon[component];
		if (!icon) continue;
		// Carbon draws an icon for 16px and for 32px; a board may have copied either.
		for (const size of [16, 32]) {
			const key = shapeKey(renderToStaticMarkup(createElement(icon, { size })));
			if (key && !(key in shapes)) shapes[key] = quoted ?? bare;
		}
	}
	return shapes;
}
