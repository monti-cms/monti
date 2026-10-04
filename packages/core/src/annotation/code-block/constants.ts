import { type CodeLineEffectDefinition, DEFAULT_CODE_LINE_EFFECTS } from "./line-effects";
import type { AnnotationConfig, AnnotationConfigItem } from "./types";

/** Text effects (`// @char name`). The public view draws them by the renderer name (`render`). */
const CHAR_ANNOTATIONS: readonly AnnotationConfigItem[] = ["Tooltip", "strong", "em", "del", "u", "fold"].map(
	(name) => ({ name, kind: "render", source: "mdx-text", render: name, scopes: ["char", "document"] }),
);

/**
 * Code fence comment config. Order: text effects, line effects (definition list), line folding, body-link label.
 * The config the site uses is `annotationConfig` in `active.ts`.
 */
export function createAnnotationConfig(
	lineEffects: readonly CodeLineEffectDefinition[] = DEFAULT_CODE_LINE_EFFECTS,
): AnnotationConfig {
	return {
		annotations: [
			...CHAR_ANNOTATIONS,
			...lineEffects.map(
				(effect): AnnotationConfigItem => ({
					name: effect.name,
					kind: "class",
					class: effect.class,
					scopes: ["line"],
				}),
			),
			{ name: "collapse", kind: "render", render: "collapse", scopes: ["line"] },
			// The line label (`id`) that the body's `:code-ref` points to. Only adds `data-anchor` to the line; has no appearance.
			{ name: "anchor", kind: "class", class: "code-anchor", scopes: ["line"] },
		],
	};
}
