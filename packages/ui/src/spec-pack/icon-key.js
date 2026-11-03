// The shape of an `<svg>` as a key: the geometry of every shape in it, in order, without colors or other attributes. A path is read into absolute
// points (`v-2h7` and `15 8 8 8` are the same line), so the same drawing keys the same whatever way its path is written. Used in Node (to key the icon
// list) and in a board's page (to look a board's icon up), so both read a shape the same way. In a page it sets `window.iconShapeKey`.

const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const round = (number) => String(Math.round(number * 100) / 100);

/** A path's `d` as absolute commands: lines as `L x y`, curves and arcs with absolute points. */
function absolutePath(d) {
	const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
	const out = [];
	let x = 0;
	let y = 0;
	let startX = 0;
	let startY = 0;
	let index = 0;
	let command = "";
	while (index < tokens.length) {
		if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++];
		const lower = command.toLowerCase();
		const relative = command === lower;
		if (lower === "z") {
			out.push("Z");
			x = startX;
			y = startY;
			continue;
		}
		const args = tokens.slice(index, index + ARGS[lower]).map(Number);
		index += ARGS[lower];
		if (args.length < ARGS[lower] || args.some(Number.isNaN)) break;
		const ox = relative ? x : 0;
		const oy = relative ? y : 0;
		if (lower === "m" || lower === "l" || lower === "t") {
			x = ox + args[0];
			y = oy + args[1];
			out.push(`${lower === "m" ? "M" : "L"} ${round(x)} ${round(y)}`);
			if (lower === "m") {
				startX = x;
				startY = y;
				// Pairs after a move are lines.
				command = relative ? "l" : "L";
			}
		} else if (lower === "h") {
			x = ox + args[0];
			out.push(`L ${round(x)} ${round(y)}`);
		} else if (lower === "v") {
			y = (relative ? y : 0) + args[0];
			out.push(`L ${round(x)} ${round(y)}`);
		} else if (lower === "a") {
			x = ox + args[5];
			y = oy + args[6];
			out.push(`A ${args.slice(0, 5).map(round).join(" ")} ${round(x)} ${round(y)}`);
		} else {
			const points = [];
			for (let at = 0; at < args.length; at += 2) points.push(`${round(ox + args[at])} ${round(oy + args[at + 1])}`);
			x = ox + args[args.length - 2];
			y = oy + args[args.length - 1];
			out.push(`${lower.toUpperCase()} ${points.join(" ")}`);
		}
	}
	return out.join(" ");
}

/** The key of an svg's markup (its outer or inner HTML). */
export function shapeKey(markup) {
	const parts = [];
	for (const [, tag, attributes] of markup.matchAll(/<(path|circle|rect|polygon|ellipse|line)\b([^>]*)>/g)) {
		const geometry = [...attributes.matchAll(/\b(d|cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height|points)="([^"]*)"/g)]
			.map(([, name, value]) => `${name}=${name === "d" ? absolutePath(value) : value.replace(/\s+/g, " ").trim()}`)
			.join(" ");
		parts.push(`${tag}(${geometry})`);
	}
	return parts.join(";");
}

if (typeof window !== "undefined") window.iconShapeKey = shapeKey;
