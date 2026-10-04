import type { Element, Root } from "hast";
import type { ShikiTransformer } from "shiki";
import { visit } from "unist-util-visit";
import { isSafeRenderTag } from "./render-policy";

type HastPropertyValue = string | number | boolean | Array<string | number> | null | undefined;

const toHastPropertyValue = (value: unknown): HastPropertyValue => {
	if (value == null) return value;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
		return value;
	}
	return JSON.stringify(value);
};

const DENY_PROPS = new Set([
	"dangerouslysetinnerhtml",
	"children",
	"ref",
	"key",
	"__proto__",
	"prototype",
	"constructor",
	"srcdoc",
]);

const URL_PROPS = new Set(["src", "href", "xlink:href", "formaction", "action"]);

const isUnsafeUrlValue = (value: string) => {
	const normalized = value.trim().toLowerCase();
	return normalized.startsWith("javascript:") || normalized.startsWith("vbscript:") || normalized.startsWith("data:");
};

const isForbiddenPropName = (name: string) => {
	const normalized = name.trim().toLowerCase();
	if (!normalized) return true;
	if (normalized.startsWith("on")) return true;
	return DENY_PROPS.has(normalized);
};

const isAllowedPropertyValue = (name: string, value: HastPropertyValue) => {
	const normalizedName = name.trim().toLowerCase();
	if (!URL_PROPS.has(normalizedName)) return true;
	return typeof value !== "string" || !isUnsafeUrlValue(value);
};

export type Meta = Record<string, unknown>;
export type LineDecorationPayload = {
	scope: "line";
	name: string;
	range: { start: number; end: number };
	order: number;
	class: string;
	attributes?: { name: string; value: unknown }[];
};
export type LineWrapperPayload = {
	scope: "line";
	name: string;
	range: { start: number; end: number };
	order: number;
	render: string;
	attributes?: { name: string; value: unknown }[];
};

const toLineWrapperDedupKey = (wrapper: {
	render: string;
	range: { start: number; end: number };
	attributes: { name: string; value: unknown }[];
}) => {
	return JSON.stringify({
		render: wrapper.render,
		start: wrapper.range.start,
		end: wrapper.range.end,
		attributes: wrapper.attributes,
	});
};

export const addMetaToPre = (code: string, meta: Meta): ShikiTransformer => ({
	pre(node: Element) {
		if (!node.properties) node.properties = {};
		const preProperties = node.properties;

		preProperties.code = code;

		for (const [key, value] of Object.entries(meta)) {
			preProperties[key] = toHastPropertyValue(value);
		}
	},
});

export const addLineDecorations = (lineDecorations: LineDecorationPayload[] = []): ShikiTransformer => {
	const normalized = lineDecorations
		.map((decoration) => ({
			...decoration,
			class: decoration.class.trim(),
		}))
		.filter((decoration) => decoration.range.start < decoration.range.end && decoration.class.length > 0);

	const toClassList = (value: unknown): string[] => {
		if (Array.isArray(value)) {
			return value
				.map((item) => String(item))
				.flatMap((item) => item.split(/\s+/))
				.map((item) => item.trim())
				.filter((item) => item.length > 0);
		}

		if (typeof value === "string") {
			return value
				.split(/\s+/)
				.map((item) => item.trim())
				.filter((item) => item.length > 0);
		}

		return [];
	};

	return {
		line(lineEl: Element, lineNumber: number) {
			const lineIndex = lineNumber - 1;
			const onLine = normalized.filter(
				(decoration) => decoration.range.start <= lineIndex && lineIndex < decoration.range.end,
			);
			const classNames = onLine.map((decoration) => decoration.class);
			if (classNames.length === 0) return;

			if (!lineEl.properties) {
				lineEl.properties = {};
			}

			// Line label that the body `:code-ref` looks up. One line can carry several names (split by whitespace).
			const anchors = onLine
				.filter((decoration) => decoration.name === "anchor")
				.map((decoration) => decoration.attributes?.find((attr) => attr.name === "id")?.value)
				.filter((id): id is string => typeof id === "string" && /^[\w-]+$/.test(id));
			if (anchors.length) lineEl.properties["data-anchor"] = [...new Set(anchors)].join(" ");

			const existingClassNames = toClassList(lineEl.properties.className);
			const existingClasses = toClassList(lineEl.properties.class);
			const merged = [...existingClasses, ...existingClassNames, ...classNames];
			lineEl.properties.className = [...new Set(merged)];
		},
	};
};

type ElementPathItem = {
	node: Element;
	indexInParent: number;
};

const getTopLevelLineElements = (codeEl: Element) =>
	codeEl.children.filter((node): node is Element => node.type === "element");

const findPathToNode = (root: Element, target: Element): ElementPathItem[] | null => {
	const walk = (current: Element, path: ElementPathItem[]): ElementPathItem[] | null => {
		if (current === target) return path;

		for (let index = 0; index < current.children.length; index += 1) {
			const child = current.children[index];
			if (child.type !== "element") continue;
			const next = walk(child, [...path, { node: child, indexInParent: index }]);
			if (next) return next;
		}

		return null;
	};

	return walk(root, [{ node: root, indexInParent: -1 }]);
};

const wrapRangeByLines = (
	root: Element,
	startLine: Element,
	endLine: Element,
	tagName: string,
	properties: Record<string, HastPropertyValue>,
) => {
	const startPath = findPathToNode(root, startLine);
	const endPath = findPathToNode(root, endLine);
	if (!startPath || !endPath) return;

	let lcaPathIndex = 0;
	while (
		lcaPathIndex < startPath.length &&
		lcaPathIndex < endPath.length &&
		startPath[lcaPathIndex].node === endPath[lcaPathIndex].node
	) {
		lcaPathIndex += 1;
	}
	lcaPathIndex -= 1;
	if (lcaPathIndex < 0) return;

	if (startLine === endLine && lcaPathIndex === startPath.length - 1) {
		lcaPathIndex -= 1;
		if (lcaPathIndex < 0) return;
	}

	const lca = startPath[lcaPathIndex].node;
	const startEntry = startPath[lcaPathIndex + 1];
	const endEntry = endPath[lcaPathIndex + 1];
	if (!startEntry || !endEntry) return;

	const from = Math.min(startEntry.indexInParent, endEntry.indexInParent);
	let to = Math.max(startEntry.indexInParent, endEntry.indexInParent);

	// Keep the trailing newline token with the wrapped block so collapsed wrappers
	// do not leave an empty visual line between the summary and next code line.
	const trailingNode = lca.children[to + 1];
	if (trailingNode?.type === "text" && trailingNode.value === "\n") {
		to += 1;
	}

	const targetChildren = lca.children.slice(from, to + 1);
	if (targetChildren.length === 0) return;

	const wrapper: Element = {
		type: "element",
		tagName,
		properties,
		children: targetChildren,
	};

	lca.children.splice(from, to - from + 1, wrapper);
};

export const applyLineWrappers = (
	codeEl: Element,
	rowWrappers: LineWrapperPayload[] = [],
	allowedRenderTags: readonly string[] = [],
): void => {
	const allowedRenderTagSet = new Set(allowedRenderTags.map((tag) => tag.trim()).filter(isSafeRenderTag));
	const normalized = rowWrappers
		.map((wrapper) => ({
			...wrapper,
			render: wrapper.render.trim(),
			attributes: (wrapper.attributes ?? []).filter((attr) => typeof attr.name === "string" && attr.name.length > 0),
		}))
		.filter(
			(wrapper) =>
				wrapper.range.start < wrapper.range.end && wrapper.render.length > 0 && allowedRenderTagSet.has(wrapper.render),
		)
		.sort((a, b) => a.order - b.order);

	const deduped: typeof normalized = [];
	const seen = new Set<string>();
	for (const wrapper of normalized) {
		const key = toLineWrapperDedupKey(wrapper);
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(wrapper);
	}

	const lines = getTopLevelLineElements(codeEl);

	for (const wrapper of deduped) {
		const { start, end } = wrapper.range;
		if (start < 0) continue;
		const clampedEnd = Math.min(end, lines.length);
		if (clampedEnd <= start) continue;

		const startLine = lines[start];
		const endLine = lines[clampedEnd - 1];
		if (!startLine || !endLine) continue;

		const properties: Record<string, HastPropertyValue> = {};
		for (const attribute of wrapper.attributes) {
			const propName = attribute.name.trim();
			if (isForbiddenPropName(propName)) continue;
			const propValue = toHastPropertyValue(attribute.value);
			if (!isAllowedPropertyValue(propName, propValue)) continue;
			properties[propName] = propValue;
		}

		wrapRangeByLines(codeEl, startLine, endLine, wrapper.render, properties);
	}
};

export const addLineWrappers = (
	rowWrappers: LineWrapperPayload[] = [],
	allowedRenderTags: readonly string[] = [],
): ShikiTransformer => {
	return {
		root(root: Root) {
			visit(root, "element", (el) => {
				if (el.tagName !== "code") return;
				applyLineWrappers(el, rowWrappers, allowedRenderTags);
			});
		},
	};
};
export const applyInlineAnnoRenderTags = (codeEl: Element, allowedRenderTags: readonly string[] = []) => {
	const allowedRenderTagSet = new Set(allowedRenderTags.map((tag) => tag.trim()).filter(isSafeRenderTag));

	visit(codeEl, "element", (el) => {
		el.properties ??= {};
		const p = el.properties;

		const render = p["data-anno-render"] ?? p.dataAnnoRender;

		if (!render) return;
		if (typeof render !== "string" || !isSafeRenderTag(render)) return;
		if (!allowedRenderTagSet.has(render.trim())) return;

		el.tagName = render;

		for (const [k, v] of Object.entries(p)) {
			if (typeof k === "string") {
				const isRender = k === "data-anno-render";
				const isDash = k.startsWith("data-anno-");
				if (!isDash || isRender) continue;

				// Build the prop name
				const propName = k.slice("data-anno-".length);
				if (isForbiddenPropName(propName)) continue;

				// Parse the value (try JSON.parse only for strings)
				let parsed = v;
				if (typeof v === "string") {
					try {
						parsed = JSON.parse(v);
					} catch {
						parsed = v; // Keep as is if it is not JSON
					}
				}

				if (!isAllowedPropertyValue(propName, parsed as HastPropertyValue)) continue;
				p[propName] = parsed;
			}
		}

		for (const k of Object.keys(p)) {
			if (k.startsWith("data-anno-")) delete p[k];
		}
	});
};

export const convertInlineAnnoToRenderTag = (allowedRenderTags: readonly string[] = []): ShikiTransformer => ({
	root(root: Root) {
		visit(root, "element", (el) => {
			if (el.tagName !== "code") return;
			applyInlineAnnoRenderTags(el, allowedRenderTags);
		});
	},
});

/**
 * Numbers in-code tooltips in order (`note`) and passes the description list to the `<pre>`'s `notes` (JSON).
 * On touch devices (screens without hover), a number and a list of notes below the code are shown instead of a tooltip (`pre`, `Tooltip`).
 * It must run after line wrapping (folding) is done so that the visible order matches the numbers.
 */
export const numberCodeNotes = (): ShikiTransformer => ({
	root(root: Root) {
		const pre = root.children.find((child): child is Element => child.type === "element" && child.tagName === "pre");
		if (!pre) return;
		const notes: string[] = [];
		visit(pre, "element", (el) => {
			if (el.tagName !== "Tooltip") return;
			const content = el.properties?.content;
			notes.push(typeof content === "string" ? content : String(content ?? ""));
			el.properties = { ...el.properties, note: String(notes.length) };
		});
		if (notes.length) pre.properties = { ...pre.properties, notes: JSON.stringify(notes) };
	},
});

/** Whether the code fence meta turned line numbers on (`lnum`, `showLineNumbers`; `=false` turns them off). */
export const showsLineNumbers = (meta: Meta) =>
	[meta.lnum, meta.showLineNumbers].some((value) => value === true || value === "" || value === "true");

/**
 * Puts the actual line number (`data-line`) on each line. Line numbers use this value instead of a CSS counter —
 * folded lines (`collapse`) are not on screen so a counter does not count them, and line numbers after the fold would shift.
 */
export const addLineNumbers = (): ShikiTransformer => ({
	line(node: Element, line: number) {
		node.properties = { ...node.properties, "data-line": line };
	},
});
