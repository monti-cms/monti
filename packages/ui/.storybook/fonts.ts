import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** Pretendard's metric overrides (see {@link fontFaces}). */
const ASCENT_OVERRIDE = "92.4%";
const DESCENT_OVERRIDE = "19%";

const require = createRequire(import.meta.url);
const pretendardDir = path.dirname(require.resolve("pretendard/package.json"));
const plexDir = path.dirname(require.resolve("@fontsource/ibm-plex-mono/package.json"));

/** The folders `fontFaces` links to, served at `./fonts/pretendard` and `./fonts/ibm-plex-mono`. */
export const fontDirs = {
	pretendard: path.join(pretendardDir, "dist", "web", "variable", "woff2-dynamic-subset"),
	plex: path.join(plexDir, "files"),
};

/** Hangul Syllables, Hangul Jamo and Hangul Compatibility Jamo: what the mono stack takes from Pretendard (`Monti Pretendard Hangul`). */
const HANGUL: readonly (readonly [number, number])[] = [
	[0xac00, 0xd7af],
	[0x1100, 0x11ff],
	[0x3130, 0x318f],
];

/** The ranges of a `unicode-range` value, as `[from, to]` pairs (`U+AC00-D7AF, U+3131` and wildcards such as `U+4??` are read). */
function rangesOf(value: string): [number, number][] {
	return value
		.split(",")
		.map((part) => part.trim().replace(/^U\+/i, ""))
		.filter(Boolean)
		.map((part): [number, number] => {
			if (part.includes("?"))
				return [Number.parseInt(part.replace(/\?/g, "0"), 16), Number.parseInt(part.replace(/\?/g, "f"), 16)];
			const [from, to] = part.split("-");
			return [Number.parseInt(from ?? "", 16), Number.parseInt(to ?? from ?? "", 16)];
		});
}

/**
 * Pretendard's faces again under `Monti Pretendard Hangul`, each limited to the Hangul inside its own slice. The mono stack lists this name after
 * the monospace fonts, so Korean in a mono place has one font that is the same everywhere, while Latin letters, Cyrillic, Greek and symbols stay with
 * Plex Mono and the system's monospace, never proportional Pretendard.
 */
function hangulFaces(pretendard: string): string {
	return (pretendard.match(/@font-face\s*\{[^}]*\}/g) ?? [])
		.flatMap((face) => {
			const range = /unicode-range:\s*([^;}]*)/.exec(face)?.[1];
			if (!range) return [];
			const kept = rangesOf(range).flatMap(([from, to]) =>
				HANGUL.flatMap(([low, high]) => {
					const [start, end] = [Math.max(from, low), Math.min(to, high)];
					return start <= end ? [`U+${start.toString(16).toUpperCase()}-${end.toString(16).toUpperCase()}`] : [];
				}),
			);
			if (kept.length === 0) return [];
			return [
				face
					.replace('"Monti Pretendard"', '"Monti Pretendard Hangul"')
					.replace(/unicode-range:\s*[^;}]*/, `unicode-range: ${kept.join(", ")}`),
			];
		})
		.join("\n");
}

/**
 * The admin's fonts as `@font-face` rules, under the names the font tokens read (`Monti Pretendard`, `Monti Plex Mono`), so they never collide with a
 * site's own copy. Pretendard is the variable font in its dynamic subsets (a page downloads only the slices it shows); IBM Plex Mono is the latin
 * subset in 400, 500 and 600.
 *
 * Pretendard is balanced here, not by nudging parts: its own ascent (0.952em) and descent (0.241em) put the center of Hangul and Latin capitals 0.355em
 * above the baseline, which in a fixed-height box leaves the text up to a pixel high at some sizes (11, 13 and 16px). `ASCENT_OVERRIDE` and
 * `DESCENT_OVERRIDE` move the baseline so the ink sits within about half a pixel of the center at every size, and `line-gap-override: 0%` keeps the line
 * box to the explicit line heights. A font that replaces it must be balanced the same way, never by nudging parts with padding.
 */
export function fontFaces(): string {
	const pretendard = readFileSync(
		path.join(pretendardDir, "dist", "web", "variable", "pretendardvariable-dynamic-subset.css"),
		"utf8",
	)
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\s+/g, " ")
		.replace(/'Pretendard Variable'/g, '"Monti Pretendard"')
		.replace(/url\(\.\/woff2-dynamic-subset\//g, "url(./fonts/pretendard/")
		.replace(/format\('woff2-variations'\)/g, 'format("woff2")')
		.replace(
			/font-display: swap;/g,
			`font-display: swap; ascent-override: ${ASCENT_OVERRIDE}; descent-override: ${DESCENT_OVERRIDE}; line-gap-override: 0%;`,
		)
		.replace(/\} /g, "}\n")
		.trim();
	const latin = JSON.parse(readFileSync(path.join(plexDir, "unicode.json"), "utf8")).latin;
	const plex = [400, 500, 600]
		.map(
			(weight) =>
				`@font-face{font-family:"Monti Plex Mono";font-style:normal;font-display:swap;font-weight:${weight};` +
				`src:url(./fonts/ibm-plex-mono/ibm-plex-mono-latin-${weight}-normal.woff2) format("woff2");unicode-range:${latin}}`,
		)
		.join("\n");
	return `${pretendard}\n${hangulFaces(pretendard)}\n${plex}\n`;
}
