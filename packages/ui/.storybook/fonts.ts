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
	return `${pretendard}\n${plex}\n`;
}
