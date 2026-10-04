import type { Code } from "mdast";
import { resolveCommentSyntax } from "./comment-syntax";
import { createAnnotationRegistry, supportsAnnotationScope } from "./libs";
import type {
	AnnotationConfig,
	AnnotationRegistryItem,
	AnnotationScope,
	CodeBlockDocument,
	CodeBlockRule,
	InlineAnnotation,
} from "./types";

const DEFAULT_CODE_LANG = "text";
const ATTR_RE = /([A-Za-z_][\w-]*)(?:\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+)))?/g;

type ScopeKeyword = "char" | "line" | "document";
type ScopeSelector =
	| {
			kind: "range";
			start: number;
			end: number;
	  }
	| {
			kind: "regex";
			regex: RegExp;
	  };

type ParsedScopeComment = {
	scope: ScopeKeyword;
	name: string;
	selector?: ScopeSelector;
	attributes: { name: string; value: unknown }[];
};

type AnnotationRegistry = ReturnType<typeof createAnnotationRegistry>;

type PendingScopeInlineDirective = {
	name: string;
	attributes: { name: string; value: unknown }[];
	config: AnnotationRegistryItem;
	selector?: ScopeSelector;
	/** 정규식 선택자면 `rules`에 등록한 규칙 번호. */
	ruleIndex?: number;
};

type PendingScopeDocumentDirective = PendingScopeInlineDirective;

type PendingScopeLineMarkerBase = {
	name: string;
	order: number;
	attributes: { name: string; value: unknown }[];
	startLineIndex: number;
	config: AnnotationRegistryItem;
	kind: "class" | "render";
};

type PendingScopeLineMarker = PendingScopeLineMarkerBase;

type StagedInlineAnnotation = {
	lineIndex: number;
	annotation: CodeBlockDocument["lines"][number]["annotations"][number];
};

const SCOPE_ALIASES: Record<string, ScopeKeyword> = {
	char: "char",
	line: "line",
	document: "document",
};

const parseUnquotedAttrValue = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};

export const parseCodeFenceMeta = (meta: string): CodeBlockDocument["meta"] => {
	const parsed: CodeBlockDocument["meta"] = {};
	const input = meta.trim();
	let index = 0;

	const isWhitespace = (ch: string) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
	const skipWhitespace = () => {
		while (index < input.length && isWhitespace(input[index])) index += 1;
	};

	const readKey = () => {
		const start = index;
		while (index < input.length) {
			const ch = input[index];
			if (ch === "=" || isWhitespace(ch)) break;
			index += 1;
		}
		return input.slice(start, index);
	};

	const readUnquotedValue = () => {
		const start = index;
		while (index < input.length && !isWhitespace(input[index])) index += 1;
		return input.slice(start, index);
	};

	const readQuotedValue = (quote: '"' | "'") => {
		index += 1;
		let value = "";

		while (index < input.length) {
			const ch = input[index];

			if (ch === "\\") {
				const next = input[index + 1];
				if (next == null) break;
				if (next === "n") value += "\n";
				else if (next === "t") value += "\t";
				else value += next;
				index += 2;
				continue;
			}

			if (ch === quote) {
				index += 1;
				return value;
			}

			value += ch;
			index += 1;
		}

		return value;
	};

	while (index < input.length) {
		skipWhitespace();
		if (index >= input.length) break;

		const key = readKey();
		if (!key) break;

		skipWhitespace();
		if (input[index] !== "=") {
			parsed[key] = true;
			continue;
		}

		index += 1;
		skipWhitespace();

		const firstChar = input[index];
		const raw = firstChar === '"' || firstChar === "'" ? readQuotedValue(firstChar) : readUnquotedValue();

		if (raw === "true") {
			parsed[key] = true;
			continue;
		}

		if (raw === "false") {
			parsed[key] = false;
			continue;
		}

		parsed[key] = raw;
	}

	return parsed;
};

const parseAnnotationAttrs = (rest: string) => {
	const attrs: { name: string; value: unknown }[] = [];

	for (const match of rest.matchAll(ATTR_RE)) {
		const name = match[1];
		const doubleQuotedRaw = match[2];
		const singleQuotedRaw = match[3];
		const unquotedRaw = match[4];
		let value: unknown;

		if (doubleQuotedRaw === undefined && singleQuotedRaw === undefined && unquotedRaw === undefined) {
			value = true;
		} else if (typeof doubleQuotedRaw === "string" || typeof singleQuotedRaw === "string") {
			const raw = (doubleQuotedRaw ?? singleQuotedRaw ?? "").replace(/\\(["'\\])/g, "$1");
			value = raw;
		} else {
			value = parseUnquotedAttrValue(unquotedRaw ?? "");
		}

		attrs.push({ name, value });
	}

	return attrs;
};

const getStylePayload = (config: AnnotationRegistryItem) => {
	if (typeof config.class === "string") {
		return { class: config.class };
	}

	if (typeof config.render === "string") {
		return { render: config.render };
	}

	return {};
};

const extractCommentBody = (line: string, commentSyntax: { prefix: string; postfix: string }) => {
	const trimmed = line.trim();
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();
	let body = trimmed;

	if (prefix) {
		if (!body.startsWith(prefix)) return;
		body = body.slice(prefix.length).trimStart();
	}

	if (postfix) {
		if (!body.endsWith(postfix)) return;
		body = body.slice(0, body.length - postfix.length).trimEnd();
	}

	return body;
};

const parseRegexLiteral = (raw: string): RegExp | undefined => {
	const match = raw.trim().match(/^\/((?:\\.|[^\\/])*)\/([a-z]*)$/i);
	if (!match) return;

	try {
		return new RegExp(match[1], match[2]);
	} catch {
		return;
	}
};

const parseScopeSelector = (raw: string): ScopeSelector | undefined => {
	const trimmed = raw.trim();
	const rangeMatch = trimmed.match(/^(?<start>\d+)\s*-\s*(?<end>\d+)$/);
	if (rangeMatch?.groups) {
		const start = Number(rangeMatch.groups.start);
		const end = Number(rangeMatch.groups.end);
		if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return;
		return { kind: "range", start, end };
	}

	if (!trimmed.startsWith("re:")) return;
	const regex = parseRegexLiteral(trimmed.slice(3));
	if (!regex) return;
	return { kind: "regex", regex };
};

/** `{...}` 선택자의 닫는 `}` 위치. 정규식(`{re:/a{2}/}`) 안의 `}`·`/`는 건너뛴다. */
const findSelectorEnd = (tail: string): number => {
	if (!tail.startsWith("{re:/")) return tail.indexOf("}");
	let index = 5;
	let inClass = false;
	while (index < tail.length) {
		const ch = tail[index];
		if (ch === "\\") {
			index += 2;
			continue;
		}
		if (ch === "[") inClass = true;
		else if (ch === "]") inClass = false;
		else if (ch === "/" && !inClass) break;
		index += 1;
	}
	index += 1;
	while (index < tail.length && /[a-z]/i.test(tail[index] ?? "")) index += 1;
	return tail[index] === "}" ? index : -1;
};

const parseScopeComment = (
	line: string,
	commentSyntax: { prefix: string; postfix: string },
): ParsedScopeComment | undefined => {
	const body = extractCommentBody(line, commentSyntax);
	if (!body?.startsWith("@")) return;

	const raw = body.slice(1).trim();
	const scopeMatch = raw.match(/^(?<scope>[A-Za-z][\w-]*)\s+(?<rest>.+)$/);
	if (!scopeMatch?.groups) return;

	const normalizedScope = SCOPE_ALIASES[scopeMatch.groups.scope];
	if (!normalizedScope) return;

	const rest = scopeMatch.groups.rest.trim();
	const nameMatch = rest.match(/^(?<name>[A-Za-z_][\w-]*)(?<tail>[\s\S]*)$/);
	if (!nameMatch?.groups) return;

	const name = nameMatch.groups.name;
	let tail = nameMatch.groups.tail.trim();
	let selector: ScopeSelector | undefined;

	if (tail.startsWith("{")) {
		const selectorEnd = findSelectorEnd(tail);
		if (selectorEnd < 0) return;
		const selectorRaw = tail.slice(1, selectorEnd);
		selector = parseScopeSelector(selectorRaw);
		if (!selector) return;
		tail = tail.slice(selectorEnd + 1).trim();
	}

	return {
		scope: normalizedScope,
		name,
		selector,
		attributes: parseAnnotationAttrs(tail),
	};
};

const toHalfOpenRangeFromClosed = (range: { start: number; end: number }) => ({
	start: range.start,
	end: range.end + 1,
});

const collectRegexRanges = (input: string, regex: RegExp) => {
	const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
	const matcher = new RegExp(regex.source, flags);
	const ranges: Array<{ start: number; end: number }> = [];
	let match = matcher.exec(input);

	while (match) {
		const start = match.index;
		const text = match[0] ?? "";
		const end = start + text.length;
		if (end > start) {
			ranges.push({ start, end });
		} else {
			matcher.lastIndex += 1;
		}
		match = matcher.exec(input);
	}

	return ranges;
};

const makeInlineAnnotationFromConfig = ({
	config,
	scope,
	name,
	range,
	attributes,
	order,
}: {
	config: AnnotationRegistryItem;
	scope: Extract<AnnotationScope, "char" | "document">;
	name: string;
	range: { start: number; end: number };
	attributes: { name: string; value: unknown }[];
	order: number;
}): InlineAnnotation | undefined => {
	if (!supportsAnnotationScope(config, scope)) return;
	const style = getStylePayload(config);
	if (config.kind === "class" && typeof style.class !== "string") return;
	if (config.kind === "render" && typeof style.render !== "string") return;

	const base = {
		...style,
		priority: config.priority,
		scope,
		name,
		range,
		attributes,
		order,
		source: config.source,
	};
	return base;
};

const pushScopeLineAnnotation = ({
	annotations,
	marker,
	endLineIndex,
}: {
	annotations: CodeBlockDocument["annotations"];
	marker: PendingScopeLineMarker;
	endLineIndex: number;
}) => {
	if (!supportsAnnotationScope(marker.config, "line")) return;
	const style = getStylePayload(marker.config);
	if (marker.kind === "class" && typeof style.class !== "string") return;
	if (marker.kind === "render" && typeof style.render !== "string") return;

	const range = {
		start: marker.startLineIndex,
		end: endLineIndex,
	};
	if (range.end <= range.start) return;

	annotations.push({
		...style,
		priority: marker.config.priority,
		scope: "line",
		name: marker.name,
		range,
		order: marker.order,
		attributes: marker.attributes,
	});
};

const findScopeLineMarkerIndex = ({
	pendingScopeLineMarkers,
	targetName,
	targetKind,
}: {
	pendingScopeLineMarkers: PendingScopeLineMarker[];
	targetName: string;
	targetKind: "class" | "render";
}) => {
	for (let idx = pendingScopeLineMarkers.length - 1; idx >= 0; idx -= 1) {
		const marker = pendingScopeLineMarkers[idx];
		if (!marker || marker.name !== targetName || marker.kind !== targetKind) continue;
		return idx;
	}

	return -1;
};

const pushInlineDirectiveMatchesForLine = ({
	directive,
	lineText,
	lineIndex,
	stagedInline,
}: {
	directive: PendingScopeInlineDirective;
	lineText: string;
	lineIndex: number;
	stagedInline: StagedInlineAnnotation[];
}) => {
	const selector = directive.selector;
	const ranges =
		selector?.kind === "range"
			? [toHalfOpenRangeFromClosed({ start: selector.start, end: selector.end })]
			: selector?.kind === "regex"
				? collectRegexRanges(lineText, selector.regex)
				: [{ start: 0, end: lineText.length }];

	for (const range of ranges) {
		const start = Math.max(0, range.start);
		const end = Math.min(lineText.length, range.end);
		if (end <= start) continue;

		const annotation = makeInlineAnnotationFromConfig({
			config: directive.config,
			scope: "char",
			name: directive.name,
			range: { start, end },
			attributes: directive.attributes,
			order: stagedInline.length,
		});
		if (!annotation) continue;
		if (directive.ruleIndex !== undefined) annotation.rule = directive.ruleIndex;

		stagedInline.push({
			lineIndex,
			annotation,
		});
	}
};

const tryConsumeScopeComment = ({
	lineText,
	commentSyntax,
	parseLineAnnotations,
	registry,
	linesLength,
	pendingScopeInlineDirectives,
	pendingScopeLineMarkers,
	pendingScopeDocumentDirectives,
	annotations,
	rules,
	nextOrder,
}: {
	lineText: string;
	commentSyntax: { prefix: string; postfix: string };
	parseLineAnnotations: boolean;
	registry: AnnotationRegistry;
	linesLength: number;
	pendingScopeInlineDirectives: PendingScopeInlineDirective[];
	pendingScopeLineMarkers: PendingScopeLineMarker[];
	pendingScopeDocumentDirectives: PendingScopeDocumentDirective[];
	annotations: CodeBlockDocument["annotations"];
	rules: CodeBlockRule[];
	nextOrder: number;
}) => {
	const parsed = parseScopeComment(lineText, commentSyntax);
	if (!parsed) return false;

	const hasEndAttr = parsed.attributes.some((attr) => attr.name === "end" && attr.value === true);
	const markerAttributes = parsed.attributes.filter((attr) => !(attr.name === "end" && attr.value === true));
	const config = registry.get(parsed.name);
	if (!config) return false;

	const registerRule = (scope: "char" | "document") => {
		if (parsed.selector?.kind !== "regex") return undefined;
		const { source, flags } = parsed.selector.regex;
		rules.push({ scope, name: parsed.name, pattern: source, flags, attributes: markerAttributes });
		return rules.length - 1;
	};

	if (parsed.scope === "char") {
		if (!supportsAnnotationScope(config, "char")) return false;
		pendingScopeInlineDirectives.push({
			name: parsed.name,
			attributes: markerAttributes,
			config,
			selector: parsed.selector,
			ruleIndex: registerRule("char"),
		});
		return true;
	}

	if (parsed.scope === "document") {
		if (!parseLineAnnotations) return false;
		if (!supportsAnnotationScope(config, "document")) return false;

		pendingScopeDocumentDirectives.push({
			name: parsed.name,
			attributes: markerAttributes,
			config,
			selector: parsed.selector,
			ruleIndex: registerRule("document"),
		});
		return true;
	}

	if (!parseLineAnnotations) return false;
	if (!supportsAnnotationScope(config, "line")) return false;
	const lineAnnotationKind = config.kind;
	const style = getStylePayload(config);
	if (lineAnnotationKind === "class" && typeof style.class !== "string") return false;
	if (lineAnnotationKind === "render" && typeof style.render !== "string") return false;

	if (parsed.selector?.kind === "range") {
		const range = toHalfOpenRangeFromClosed({
			start: parsed.selector.start,
			end: parsed.selector.end,
		});

		annotations.push({
			...style,
			priority: config.priority,
			scope: "line",
			name: parsed.name,
			range,
			order: annotations.length,
			attributes: markerAttributes,
		});
		return true;
	}

	if (parsed.selector?.kind === "regex") {
		return true;
	}

	if (hasEndAttr) {
		const matchedIndex = findScopeLineMarkerIndex({
			pendingScopeLineMarkers,
			targetName: parsed.name,
			targetKind: lineAnnotationKind,
		});
		if (matchedIndex < 0) return true;

		const [marker] = pendingScopeLineMarkers.splice(matchedIndex, 1);
		if (!marker) return true;

		pushScopeLineAnnotation({
			annotations,
			marker,
			endLineIndex: linesLength,
		});
		return true;
	}

	pendingScopeLineMarkers.push({
		name: parsed.name,
		order: nextOrder,
		attributes: markerAttributes,
		startLineIndex: linesLength,
		config,
		kind: lineAnnotationKind,
	});
	return true;
};

const commitCodeLine = ({
	lines,
	pendingScopeInlineDirectives,
	stagedInline,
	rules,
	lineText,
}: {
	lines: CodeBlockDocument["lines"];
	rules: CodeBlockRule[];
	pendingScopeInlineDirectives: PendingScopeInlineDirective[];
	stagedInline: StagedInlineAnnotation[];
	lineText: string;
}) => {
	const lineIndex = lines.length;
	lines.push({
		value: lineText,
		annotations: [],
	});

	for (const directive of pendingScopeInlineDirectives) {
		const rule = directive.ruleIndex === undefined ? undefined : rules[directive.ruleIndex];
		if (rule) rule.line = lineIndex;
		pushInlineDirectiveMatchesForLine({
			directive,
			lineText,
			lineIndex,
			stagedInline,
		});
	}
	pendingScopeInlineDirectives.length = 0;
};

const parseCodeLines = ({
	codeValue,
	parseLineAnnotations,
	commentSyntax,
	registry,
}: {
	codeValue: string;
	parseLineAnnotations: boolean;
	commentSyntax: { prefix: string; postfix: string };
	registry: AnnotationRegistry;
}) => {
	const lines: CodeBlockDocument["lines"] = [];
	const annotations: CodeBlockDocument["annotations"] = [];
	const pendingScopeInlineDirectives: PendingScopeInlineDirective[] = [];
	const pendingScopeLineMarkers: PendingScopeLineMarker[] = [];
	const pendingScopeDocumentDirectives: PendingScopeDocumentDirective[] = [];
	const stagedInline: StagedInlineAnnotation[] = [];
	const rules: CodeBlockRule[] = [];
	let lineMarkerOrder = 0;

	for (const lineText of codeValue.split("\n")) {
		const consumed = tryConsumeScopeComment({
			lineText,
			commentSyntax,
			parseLineAnnotations,
			registry,
			linesLength: lines.length,
			pendingScopeInlineDirectives,
			pendingScopeLineMarkers,
			pendingScopeDocumentDirectives,
			annotations,
			rules,
			nextOrder: lineMarkerOrder,
		});
		if (consumed) {
			lineMarkerOrder += 1;
			continue;
		}

		commitCodeLine({
			lines,
			pendingScopeInlineDirectives,
			stagedInline,
			rules,
			lineText,
		});
	}

	for (const marker of pendingScopeLineMarkers) {
		const endLineIndex = marker.kind === "class" ? Math.min(lines.length, marker.startLineIndex + 1) : lines.length;
		pushScopeLineAnnotation({
			annotations,
			marker,
			endLineIndex,
		});
	}

	return { lines, annotations, stagedInline, pendingScopeDocumentDirectives, rules };
};

const applyAbsoluteInlineRanges = (lines: CodeBlockDocument["lines"], stagedInline: StagedInlineAnnotation[]) => {
	let lineStart = 0;

	lines.forEach((line, lineIndex) => {
		const lineEnd = lineStart + line.value.length;
		const inlineForLine = stagedInline
			.filter((item) => item.lineIndex === lineIndex)
			.map((item, order) => ({
				...item.annotation,
				range: {
					start: lineStart + item.annotation.range.start,
					end: lineStart + item.annotation.range.end,
				},
				order,
			}));

		line.annotations = inlineForLine;
		lineStart = lineEnd + 1;
	});
};

const applyScopeDocumentDirectives = ({
	lines,
	directives,
}: {
	lines: CodeBlockDocument["lines"];
	directives: PendingScopeDocumentDirective[];
}) => {
	if (directives.length === 0 || lines.length === 0) return;
	const fullText = lines.map((line) => line.value).join("\n");

	const lineOffsets: Array<{ start: number; end: number }> = [];
	let offset = 0;
	for (const line of lines) {
		const start = offset;
		const end = start + line.value.length;
		lineOffsets.push({ start, end });
		offset = end + 1;
	}

	for (const directive of directives) {
		const selector = directive.selector;
		const ranges =
			selector?.kind === "range"
				? [toHalfOpenRangeFromClosed({ start: selector.start, end: selector.end })]
				: selector?.kind === "regex"
					? collectRegexRanges(fullText, selector.regex)
					: [{ start: 0, end: fullText.length }];

		for (const range of ranges) {
			const start = Math.max(0, range.start);
			const end = Math.min(fullText.length, range.end);
			if (end <= start) continue;

			for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
				const line = lines[lineIdx];
				const offsets = lineOffsets[lineIdx];
				if (!line || !offsets) continue;

				const segStart = Math.max(start, offsets.start);
				const segEnd = Math.min(end, offsets.end);
				if (segEnd <= segStart) continue;

				const annotation = makeInlineAnnotationFromConfig({
					config: directive.config,
					scope: "document",
					name: directive.name,
					range: { start: segStart, end: segEnd },
					attributes: directive.attributes,
					order: line.annotations.length,
				});
				if (!annotation) continue;
				if (directive.ruleIndex !== undefined) annotation.rule = directive.ruleIndex;
				line.annotations.push(annotation);
			}
		}
	}
};

export const fromCodeFenceToCodeBlockDocument = (
	codeNode: Code,
	annotationConfig: AnnotationConfig,
	options?: { parseLineAnnotations?: boolean },
): CodeBlockDocument => {
	const registry = createAnnotationRegistry(annotationConfig);
	const lang = codeNode.lang?.trim() || DEFAULT_CODE_LANG;
	const meta = parseCodeFenceMeta(codeNode.meta ?? "");
	const commentSyntax = resolveCommentSyntax(lang);
	const parseLineAnnotations = options?.parseLineAnnotations ?? true;
	const parsed = parseCodeLines({
		codeValue: codeNode.value,
		parseLineAnnotations,
		commentSyntax,
		registry,
	});

	applyAbsoluteInlineRanges(parsed.lines, parsed.stagedInline);
	applyScopeDocumentDirectives({
		lines: parsed.lines,
		directives: parsed.pendingScopeDocumentDirectives,
	});

	// 적용할 줄이 없는(코드 끝의) `@char` 규칙은 버린다. 공개 화면에도 효과가 없다. 남은 규칙 번호로 다시 잇는다.
	const renumbered = new Map<number, number>();
	const rules = parsed.rules.filter((rule, index) => {
		if (rule.scope === "char" && rule.line === undefined) return false;
		renumbered.set(index, renumbered.size);
		return true;
	});
	for (const line of parsed.lines)
		for (const annotation of line.annotations)
			if (annotation.rule !== undefined) annotation.rule = renumbered.get(annotation.rule);
	return {
		lang,
		meta,
		lines: parsed.lines,
		annotations: parsed.annotations,
		...(rules.length ? { rules } : {}),
	};
};

export const __testable__ = {
	parseCodeFenceMeta,
	parseAnnotationAttrs,
	fromCodeFenceToCodeBlockDocument,
};
