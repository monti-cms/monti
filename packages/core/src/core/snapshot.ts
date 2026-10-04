import { createHash } from "node:crypto";
import { BLOCK_BY_NAME, invalidOptionAttributes } from "../blocks/derive";
import { createTranslator } from "../i18n";
import { analyze } from "../mdx/analyze";
import { DIRECTIVE_BY_COMPONENT } from "../mdx/directives";
import { isAllowedImageSrc } from "../mdx/image-src";
import { MAX_TABLE_COLUMNS } from "../mdx/table-layout";
import type { CmsImageSource } from "../mdx/types";
import {
	fieldValueError,
	metadataReferences,
	missingRequiredIssues,
	normalizeRecordTranslations,
	RECORD_TRANSLATIONS_KEY,
	relationRule,
	schemaOf,
	storedField,
} from "../schema/derive";
import { COLLECTION_DEFINITIONS, isCollection } from "./collections";
import { isUuid } from "./ids";
import { parseInternalLink } from "./links";
import { PREFIXED_LOCALES } from "./locales";
import { coreMessages } from "./messages";
import { normalizeSlugInput } from "./slug";
import { parseTranslationState } from "./translation/state";
import {
	type Collection,
	type InternalLinkSource,
	type Issue,
	type JsonValue,
	type MetadataValue,
	type PreparedSnapshot,
	type Reference,
	type ReferenceKind,
	type ReferenceOccurrence,
	type ResolvedTargets,
	ServiceError,
	type ServiceInput,
} from "./types";

/**
 * 스냅샷 준비와 발행 검증. 순수 규칙이며 DB·HTTP를 모른다.
 * 서비스(초안 저장)와 저장소 구현(발행 트랜잭션 안의 재검증)이 같은 규칙을 쓴다.
 */

export const MAX_MDX_BYTES = 2 * 1024 * 1024;
export const MAX_METADATA_BYTES = 256 * 1024;
const isJsonArray = (value: unknown): value is readonly JsonValue[] => Array.isArray(value);

function sortKeys(obj: JsonValue): JsonValue {
	if (obj === null || typeof obj !== "object") return obj;
	if (isJsonArray(obj)) return obj.map(sortKeys);
	const record = obj;
	return Object.keys(record)
		.sort()
		.reduce<Record<string, JsonValue>>((acc, key) => {
			const val = record[key];
			if (val !== undefined) acc[key] = sortKeys(val);
			return acc;
		}, {});
}

/** 스냅샷의 내용 해시. 같은 메타데이터·본문이면 키 순서와 무관하게 같은 값이다. */
export function computeContentHash(metadata: JsonValue, mdx: string, schemaVersion = 1): string {
	const tuple = ["cms-snapshot-v1", schemaVersion, sortKeys(metadata), mdx];
	return createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
}

class ReferenceCollector {
	refs: { kind: ReferenceKind; targetId: string; isStale: boolean; occurrences: ReferenceOccurrence[] }[] = [];

	add(kind: ReferenceKind, targetId: string, occurrence: ReferenceOccurrence, isStale = false) {
		let ref = this.refs.find((r) => r.kind === kind && r.targetId === targetId);
		if (!ref) {
			ref = { kind, targetId, isStale, occurrences: [] };
			this.refs.push(ref);
		} else if (isStale) {
			ref.isStale = true;
		}
		ref.occurrences.push(occurrence);
	}
}

/** 메타데이터 관계 필드를 컬렉션 정의 순서대로 참조로 모은다. 순서·중복을 보존한다. */
function addMetadataReferences(
	collector: ReferenceCollector,
	collection: Collection,
	metadata: PreparedSnapshot["metadata"],
) {
	for (const ref of metadataReferences(collection, metadata)) {
		collector.add(ref.kind, ref.targetId, {
			type: "metadata",
			path: ref.path,
			...(ref.ordinal === undefined ? {} : { ordinal: ref.ordinal }),
		});
	}
}

/** 정확히 허용된 키만 가진 평범한 객체인가. getter·상속 속성은 거부한다. */
export function validateExactRecord(
	value: unknown,
	expectedKeys: readonly string[],
): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new ServiceError("invalid_input");
	}
	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== null) {
		throw new ServiceError("invalid_input");
	}

	const keys = Reflect.ownKeys(value);
	const expectedSet = new Set(expectedKeys);
	if (keys.length !== expectedSet.size) {
		throw new ServiceError("invalid_input");
	}

	for (const key of keys) {
		if (typeof key !== "string" || !expectedSet.has(key)) {
			throw new ServiceError("invalid_input");
		}
		const desc = Object.getOwnPropertyDescriptor(value, key);
		if (!desc || !desc.enumerable || "get" in desc || "set" in desc || !("value" in desc)) {
			throw new ServiceError("invalid_input");
		}
	}
}

export const SERVICE_INPUT_KEYS: readonly string[] = ["collection", "slug", "metadata", "mdx"];

/**
 * 필드 값 오류. 오류 코드는 필드 이름과 상관없이 같다. 글자 수 초과(`field_too_long`)는 어느 필드인지 문제(`issues`)의
 * `path`(필드 이름)와 `message`(필드 이름표)로 알린다(관리자 화면이 "<이름표>이/가 너무 깁니다."로 보인다).
 */
function fieldValueServiceError(code: string, path: string, label: string | undefined): ServiceError {
	if (code !== "field_too_long") return new ServiceError(code);
	return new ServiceError(code, [{ code, path, ...(label ? { message: label } : {}) }]);
}

function validateMetadata(collection: Collection, raw: unknown): Record<string, MetadataValue> {
	if (
		!raw ||
		typeof raw !== "object" ||
		Array.isArray(raw) ||
		(Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)
	) {
		throw new ServiceError("invalid_input");
	}
	for (const key of Reflect.ownKeys(raw)) {
		if (typeof key !== "string") throw new ServiceError("invalid_input");
		const desc = Object.getOwnPropertyDescriptor(raw, key);
		if (!desc?.enumerable || desc.get || desc.set) throw new ServiceError("invalid_input");
	}
	const input = raw as Record<string, unknown>;

	// 허용 키·저장 형식·값 규칙은 컬렉션 정의(v2 B1)에서 온다.
	const rules = COLLECTION_DEFINITIONS[collection].fields;
	const metadata: Record<string, MetadataValue> = {};
	for (const [k, v] of Object.entries(input)) {
		if (k === RECORD_TRANSLATIONS_KEY) {
			// record 컬렉션의 언어별 이름(v2 B4). 기본 언어 값은 필드 자체에 둔다.
			const normalized = normalizeRecordTranslations(collection, v, PREFIXED_LOCALES);
			if ("error" in normalized) {
				const { error, path, label } = normalized;
				throw path ? fieldValueServiceError(error, path, label) : new ServiceError(error);
			}
			if (Object.keys(normalized.value).length > 0) metadata[k] = normalized.value;
			continue;
		}
		const stored = storedField(collection, k);
		if (!stored || !Object.hasOwn(rules, k)) throw new ServiceError("invalid_metadata_key");
		if (rules[k] === "string") {
			if (typeof v !== "string") throw new ServiceError("invalid_metadata_type");
			metadata[k] = v;
		} else {
			if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) {
				throw new ServiceError("invalid_metadata_type");
			}
			if (Reflect.ownKeys(v).length !== v.length + 1) throw new ServiceError("invalid_metadata_type");
			for (let i = 0; i < v.length; i++) {
				const desc = Object.getOwnPropertyDescriptor(v, String(i));
				if (!desc || desc.get || desc.set) throw new ServiceError("invalid_metadata_type");
				if (typeof v[i] !== "string") throw new ServiceError("invalid_metadata_type");
			}
			metadata[k] = Object.freeze([...v]);
		}

		const value = metadata[k];
		const error = typeof value === "string" || Array.isArray(value) ? fieldValueError(stored.field, value) : null;
		if (error) throw fieldValueServiceError(error, k, stored.field.label);
	}

	if (Buffer.byteLength(JSON.stringify(sortKeys(metadata)), "utf8") > MAX_METADATA_BYTES) {
		throw new ServiceError("metadata_too_large");
	}
	return metadata;
}

type MdxNode = {
	type?: unknown;
	name?: unknown;
	url?: unknown;
	identifier?: unknown;
	attributes?: unknown;
	children?: unknown;
	position?: { start?: { line?: unknown; column?: unknown } };
};
type MdxAttribute = { type?: unknown; name?: unknown; value?: unknown };

const isMdxNode = (node: unknown): node is MdxNode => typeof node === "object" && node !== null;
const isJsxElement = (node: MdxNode) => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

const readAttr = (node: MdxNode, key: string): MdxAttribute | undefined =>
	(Array.isArray(node.attributes) ? node.attributes : []).find(
		(a: unknown): a is MdxAttribute => isMdxNode(a) && (a as MdxAttribute).name === key,
	);

/** 속성이 있으면 그 문자열 값, `{decorative}`처럼 값 없는 속성은 `true`. */
const readAttrValue = (node: MdxNode, key: string): string | true | undefined => {
	const attr = readAttr(node, key);
	if (!attr) return undefined;
	if (attr.value === null || attr.value === undefined) return true;
	return typeof attr.value === "string" ? attr.value : undefined;
};

function findNamedJsxChildren(node: MdxNode, name: string): MdxNode[] {
	const found: MdxNode[] = [];
	const walk = (children: unknown) => {
		for (const child of Array.isArray(children) ? children : []) {
			if (!isMdxNode(child)) continue;
			if (isJsxElement(child) && child.name === name) {
				found.push(child);
			} else if (child.type === "paragraph" && Array.isArray(child.children)) {
				walk(child.children);
			}
		}
	};
	walk(node.children);
	return found;
}

const tCore = createTranslator(coreMessages);

/** 병합 한 칸이 걸칠 수 있는 최대 행·열 수. 편집기·공개 렌더의 표 열 한도와 같다. */
const MAX_TABLE_SPAN = MAX_TABLE_COLUMNS;

/** 셀의 `colspan`·`rowspan`. 없거나 글자가 아니면 1이고, 양의 정수가 아니면 잘못된 값으로 돌려준다. */
function readSpan(cell: MdxNode, key: "colspan" | "rowspan"): { span: number } | { invalid: string } {
	const raw = readAttrValue(cell, key);
	if (typeof raw !== "string") return { span: 1 };
	const parsed = Number.parseInt(raw, 10);
	return Number.isNaN(parsed) || parsed < 1 || String(parsed) !== raw.trim() ? { invalid: raw } : { span: parsed };
}

type TableSpanReason =
	| "invalid_colspan"
	| "invalid_rowspan"
	| "rowspan_overflow"
	| "span_too_large"
	| "span_overlap"
	| "ragged_rows";

/**
 * 표의 셀 병합(colspan·rowspan) 및 격자 구조를 검사하여 잘못된 span에 대해 경고한다(v2 C6).
 */
function checkTableSpans(tableNode: MdxNode, position: { line: number; column: number }, warnings: Issue[]) {
	const rows = findNamedJsxChildren(tableNode, "TableRow");
	const totalRows = rows.length;
	if (totalRows === 0) return;

	const grid: boolean[][] = Array.from({ length: totalRows }, () => []);
	let hasSpanIssue = false;
	const warn = (reason: TableSpanReason, params: Record<string, string | number> = {}) => {
		warnings.push({
			code: "invalid_table_span",
			message: tCore(`table.${reason}`, params),
			params: { reason, ...params },
			path: "mdx",
			position,
		});
		hasSpanIssue = true;
	};

	for (let r = 0; r < totalRows; r += 1) {
		const row = rows[r];
		if (!row) continue;
		const cells = findNamedJsxChildren(row, "TableCell");
		let c = 0;

		for (const cell of cells) {
			while (grid[r]?.[c]) {
				c += 1;
			}

			let cs = 1;
			const colspan = readSpan(cell, "colspan");
			if ("invalid" in colspan) warn("invalid_colspan", { value: colspan.invalid });
			else cs = colspan.span;

			let rs = 1;
			const rowspan = readSpan(cell, "rowspan");
			if ("invalid" in rowspan) warn("invalid_rowspan", { value: rowspan.invalid });
			else rs = rowspan.span;

			// 외부 MDX의 거대한 span이 격자 계산을 폭증시키지 않도록 제한한다.
			const overflowsRows = r + rs > totalRows;
			if (cs > MAX_TABLE_SPAN || rs > MAX_TABLE_SPAN || c + cs > MAX_TABLE_SPAN || overflowsRows) {
				if (overflowsRows) warn("rowspan_overflow", { rowspan: rs, rows: totalRows });
				else warn("span_too_large", { max: MAX_TABLE_SPAN });
				continue;
			}

			let overlap = false;
			for (let dr = 0; dr < rs; dr += 1) {
				for (let dc = 0; dc < cs; dc += 1) {
					const covered = grid[r + dr];
					if (!covered) continue;
					if (covered[c + dc]) overlap = true;
					covered[c + dc] = true;
				}
			}
			if (overlap) warn("span_overlap");

			c += cs;
		}
	}

	if (!hasSpanIssue) {
		const maxWidth = Math.max(...grid.map((row) => row.length), 0);
		const hasGapOrMismatch = grid.some((row) => {
			if (row.length !== maxWidth) return true;
			for (let i = 0; i < maxWidth; i += 1) {
				if (!row[i]) return true;
			}
			return false;
		});
		if (hasGapOrMismatch) {
			warn("ragged_rows");
		}
	}
}

/**
 * 블록 속성 규칙(§4.4, §5.6 "블록별 필수 속성"). 발행만 막고 초안 저장·시각 편집은 막지 않는다.
 * 저장 문법(directive)과 읽기 호환 JSX가 같은 컴포넌트 이름으로 파싱되므로 한 번만 검사한다.
 */
function checkBlockAttributes(
	node: MdxNode,
	position: { line: number; column: number },
	issues: Issue[],
	warnings: Issue[],
) {
	const name = typeof node.name === "string" ? node.name : "";
	const definition = DIRECTIVE_BY_COMPONENT.get(name);
	if (!definition) return;

	for (const key of definition.required) {
		const value = readAttrValue(node, key);
		if (typeof value !== "string" || value.trim() === "") {
			issues.push({ code: "missing_block_attribute", message: `${definition.name}.${key}`, path: "mdx", position });
		}
	}
	for (const attr of Array.isArray(node.attributes) ? node.attributes : []) {
		const attrName = isMdxNode(attr) ? (attr as MdxAttribute).name : undefined;
		if (typeof attrName === "string" && !Object.hasOwn(definition.attributes, attrName)) {
			warnings.push({
				code: "unknown_block_attribute",
				message: `${definition.name}.${attrName}`,
				path: "mdx",
				position,
			});
		}
	}

	// 선택 값이 정해진 속성(정렬·콜아웃 종류 등)은 블록 정의(v2 B3)의 값만 받는다.
	const block = BLOCK_BY_NAME.get(definition.name);
	if (block) {
		const values = Object.fromEntries(Object.keys(block.attributes).map((key) => [key, readAttrValue(node, key)]));
		for (const key of invalidOptionAttributes(block, values)) {
			issues.push({
				code: "invalid_block_attribute",
				message: `${definition.name}.${key}=${String(values[key])}`,
				path: "mdx",
				position,
			});
		}
	}

	// 자식 블록의 값 중 하나여야 하는 속성(예: 처음 열 탭 → 탭 이름).
	for (const [key, attribute] of Object.entries(block?.attributes ?? {})) {
		const childKey = attribute.childValue;
		if (!block || !childKey) continue;
		const value = readAttrValue(node, key);
		if (typeof value !== "string" || !value) continue;
		const childComponents = new Set(
			(block.children?.blocks ?? []).flatMap((child) => BLOCK_BY_NAME.get(child)?.component ?? []),
		);
		const values: string[] = [];
		const collect = (children: unknown) => {
			for (const child of Array.isArray(children) ? children : []) {
				if (!isMdxNode(child)) continue;
				if (isJsxElement(child) && childComponents.has(String(child.name ?? ""))) {
					const childValue = readAttrValue(child, childKey);
					if (typeof childValue === "string") values.push(childValue);
				} else if (child.type === "paragraph") {
					collect(child.children);
				}
			}
		};
		collect(node.children);
		if (!values.includes(value)) {
			issues.push({ code: "invalid_block_attribute", message: `${block.name}.${key}=${value}`, path: "mdx", position });
		}
	}

	if (name === "Table") {
		checkTableSpans(node, position, warnings);
	}

	if (name === "Image") {
		const decorative = readAttrValue(node, "decorative") === true;
		const alt = readAttrValue(node, "alt");
		// §5.6: 설명이 필요한 새 이미지(등록 미디어)의 alt 누락은 발행 전 보완한다.
		// 이전 콘텐츠의 외부·상대 경로 이미지(`src`)는 이전 보고서에서 처리하므로 막지 않는다.
		if (!decorative && readAttr(node, "mediaId") && (typeof alt !== "string" || !alt.trim())) {
			issues.push({ code: "missing_image_alt", path: "mdx", position });
		}
	}
}

export async function prepareSnapshot(
	input: ServiceInput,
	options?: { schemaVersion?: number; previousReferences?: readonly Reference[] },
): Promise<PreparedSnapshot> {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new ServiceError("invalid_input");
	}
	validateExactRecord(input, [
		...SERVICE_INPUT_KEYS,
		...(input.folderId === undefined ? [] : ["folderId"]),
		...(input.translation === undefined ? [] : ["translation"]),
	]);
	const translation = input.translation === undefined ? undefined : parseTranslationState(input.translation);
	if (input.translation !== undefined && translation === undefined) throw new ServiceError("invalid_input");

	const rawCollection: unknown = input.collection;
	if (typeof rawCollection !== "string") throw new ServiceError("invalid_input");
	if (!isCollection(rawCollection)) throw new ServiceError("unknown_collection");

	if (input.slug !== undefined && input.slug !== null && typeof input.slug !== "string") {
		throw new ServiceError("invalid_input");
	}
	if (typeof input.mdx !== "string") throw new ServiceError("invalid_input");
	if (Buffer.byteLength(input.mdx, "utf8") > MAX_MDX_BYTES) throw new ServiceError("mdx_too_large");

	const normalizedSlug = normalizeSlugInput(input.slug);
	if ("error" in normalizedSlug) throw new ServiceError(normalizedSlug.error);
	const slug = normalizedSlug.slug;

	const metadata = validateMetadata(rawCollection, input.metadata);

	const collector = new ReferenceCollector();
	addMetadataReferences(collector, rawCollection, metadata);

	const analysis = analyze(input.mdx);
	const mdxIssues: Issue[] = analysis.errors.map((e) => ({
		code: "mdx_error",
		message: e.message,
		params: { reason: e.code, ...e.params },
		position: e.position,
	}));
	let mdxHasError = analysis.errors.length > 0;
	const blockIssues: Issue[] = [];
	const warnings: Issue[] = [];

	const mdxRefsToAdd: { kind: ReferenceKind; targetId: string; occ: ReferenceOccurrence }[] = [];
	const imageSources: CmsImageSource[] = [];
	const internalLinks: InternalLinkSource[] = [];

	const positionOf = (node: MdxNode) => {
		const pos = node.position?.start;
		return {
			line: (typeof pos?.line === "number" ? pos.line : 1) + analysis.sourceLineOffset,
			column: typeof pos?.column === "number" ? pos.column : 1,
		};
	};

	const definitions = new Map<string, string>();
	const collectDefinitions = (node: unknown) => {
		if (!isMdxNode(node)) return;
		if (node.type === "definition" && typeof node.identifier === "string" && typeof node.url === "string") {
			definitions.set(node.identifier, node.url);
		}
		if (Array.isArray(node.children)) node.children.forEach(collectDefinitions);
	};
	collectDefinitions(analysis.tree);

	const addInternalLink = (url: unknown, node: MdxNode) => {
		if (typeof url !== "string") return;
		const parsed = parseInternalLink(url);
		if (parsed) internalLinks.push({ ...parsed, position: positionOf(node) });
	};

	const addMdxError = (code: string, position: ReturnType<typeof positionOf>) => {
		mdxIssues.push({ code, position });
		mdxHasError = true;
	};

	/** 참조 ID 속성의 글자. 없거나 비면 `missing_media_id`, 식(`{...}`)이면 `dynamic_reference_id` 문제다. */
	const staticReferenceId = (attr: MdxAttribute | undefined): { id: string } | { problem: string } =>
		!attr || attr.value === null || attr.value === undefined || attr.value === ""
			? { problem: "missing_media_id" }
			: typeof attr.value !== "string"
				? { problem: "dynamic_reference_id" }
				: { id: attr.value };

	/** 등록 미디어 참조로 모은다. UUID가 아니면 본문 오류다. 참조로 남겨 사용 중인 파일을 지우지 않게 한다. */
	const addMediaReference = (mediaId: string, position: ReturnType<typeof positionOf>) => {
		if (!isUuid(mediaId)) addMdxError("invalid_reference_id", position);
		else mdxRefsToAdd.push({ kind: "media", targetId: mediaId, occ: { type: "mdx", ...position } });
	};

	const collectImage = (node: MdxNode) => {
		// 이미지는 `mediaId`(등록 미디어) 또는 `src`(외부 주소) 중 하나를 쓴다(§4.4).
		// `mediaId`만 참조 테이블 대상이다. `src`는 외부 주소라 참조가 아니다.
		const mediaIdAttr = readAttr(node, "mediaId");
		const srcAttr = readAttr(node, "src");
		const attr = mediaIdAttr ?? srcAttr;
		const position = positionOf(node);

		const reference = staticReferenceId(attr);
		if ("problem" in reference) addMdxError(reference.problem, position);
		else if (attr === mediaIdAttr) addMediaReference(reference.id, position);

		const mediaId = typeof mediaIdAttr?.value === "string" ? mediaIdAttr.value : undefined;
		const src = typeof srcAttr?.value === "string" ? srcAttr.value : undefined;
		if (mediaId || src) imageSources.push({ ...(mediaId ? { mediaId } : { src }), position });
	};

	/** 첨부 파일 카드(v3). `mediaId`가 꼭 있어야 한다. */
	const collectFile = (node: MdxNode) => {
		const attr = readAttr(node, "mediaId");
		const position = positionOf(node);
		const reference = staticReferenceId(attr);
		if ("problem" in reference) addMdxError(reference.problem, position);
		else addMediaReference(reference.id, position);
	};

	/** 번역본에 남은 번역 안내 글(v3). 공개 화면에는 보이지 않으므로 남은 채로 발행하지 않는다. */
	const untranslated: ReturnType<typeof positionOf>[] = [];
	const traverse = (node: unknown) => {
		if (!isMdxNode(node)) return;
		if (node.type === "link") {
			addInternalLink(node.url, node);
		} else if (node.type === "linkReference" && typeof node.identifier === "string") {
			addInternalLink(definitions.get(node.identifier), node);
		}
		if (isJsxElement(node)) {
			// `ContentLink`는 배치 4에서 폐기했다 — 본문에 남아 있으면 `analyze`가 거부한다.
			if (node.name === "Image") collectImage(node);
			if (node.name === "File") collectFile(node);
			if (node.name === "Untranslated") untranslated.push(positionOf(node));
			checkBlockAttributes(node, positionOf(node), blockIssues, warnings);
		}
		if (Array.isArray(node.children)) node.children.forEach(traverse);
	};
	traverse(analysis.tree);

	if (mdxHasError) {
		// 분석하지 못한 본문은 과거 본문 참조를 stale로 유지한다(§6.1). 과거 참조는 저장소에서만 온다.
		for (const ref of options?.previousReferences ?? []) {
			for (const occ of ref.occurrences) {
				if (occ.type !== "metadata") collector.add(ref.kind, ref.targetId, { ...occ }, true);
			}
		}
	} else {
		for (const item of mdxRefsToAdd) collector.add(item.kind, item.targetId, item.occ, false);
	}

	const issues: Issue[] = [...mdxIssues, ...blockIssues];
	const firstUntranslated = untranslated[0];
	if (firstUntranslated) {
		issues.push({
			code: "untranslated_text",
			position: firstUntranslated,
			message: tCore("untranslatedCount", { count: untranslated.length }),
			params: { count: untranslated.length },
		});
	}
	if (analysis.frontmatter !== null) {
		issues.push({ code: "frontmatter_present", path: "frontmatter", position: { line: 1, column: 1 } });
	}

	let schemaVersion = 1;
	if (options?.schemaVersion !== undefined) {
		if (!Number.isInteger(options.schemaVersion) || options.schemaVersion <= 0) {
			throw new ServiceError("invalid_input");
		}
		schemaVersion = options.schemaVersion;
	}

	const freeze = <T extends object>(items: T[]) => Object.freeze(items.map((item) => Object.freeze({ ...item })));

	return Object.freeze({
		collection: rawCollection,
		slug,
		metadata: Object.freeze(metadata),
		mdx: input.mdx,
		schemaVersion,
		contentHash: computeContentHash(metadata, input.mdx, schemaVersion),
		references: Object.freeze(
			collector.refs.map((ref) =>
				Object.freeze({ ...ref, occurrences: Object.freeze(ref.occurrences.map((o) => Object.freeze({ ...o }))) }),
			),
		),
		issues: freeze(issues),
		warnings: freeze(warnings),
		internalLinks: Object.freeze(
			internalLinks.map((link) => Object.freeze({ ...link, position: Object.freeze({ ...link.position }) })),
		),
		imageSources: freeze(imageSources),
		...(translation === undefined ? {} : { translation }),
	});
}

/**
 * §4.4 이미지 경고. **비차단**이며 발행을 막지 않는다.
 *
 * 정상 데이터에서 실제로 발생하는 3가지만 본다: ① 미디어 행은 있으나 `ready` 아님
 * ② `ready`인데 저장소 키가 없어 해석 불가 ③ 외부 `src`가 허용 규칙에 걸림.
 * **미디어 행이 아예 없는 경우는 경고 대상이 아니다** — `entry_references`의 FK·CHECK와
 * `validateForPublish`의 `unresolved_media`가 먼저 막는다(M7 무결성 계약, A3).
 */
const imageWarnings = (sources: readonly CmsImageSource[], media: ResolvedTargets["media"]): Issue[] => {
	const warnings: Issue[] = [];
	for (const source of sources) {
		if (source.src !== undefined) {
			if (!isAllowedImageSrc(source.src)) {
				warnings.push({ code: "image_src_not_allowed", message: source.src, position: source.position });
			}
			continue;
		}
		const row = source.mediaId === undefined ? undefined : media.find((m) => m.id === source.mediaId);
		if (!row) continue;
		if (row.status !== undefined && row.status !== "ready") {
			warnings.push({ code: "image_media_not_ready", message: row.status, position: source.position });
		} else if (row.storageKey !== undefined && !row.storageKey) {
			warnings.push({ code: "image_media_unresolved", position: source.position });
		}
	}
	return warnings;
};

/**
 * 발행 응답에 실어 보낼 이미지 경고만 모은다. **비차단**이며, 계산에 실패하면 빈 배열을 돌려준다.
 *
 * `ready` + `storageKey`가 있는 미디어는 `headStorageKey`가 있으면 저장소 실물을 한 번 더 확인한다.
 * 실물이 없으면 `image_media_missing_in_storage` 경고를 추가한다. 인프라 오류 시에는 DB 판정으로 폴백한다.
 */
export async function imageWarningsForPublish(input: {
	collection: Collection;
	slug: string | null;
	metadata: { readonly [key: string]: unknown };
	mdx: string;
	getMediaAsset: (id: string) => Promise<{ status?: string; storageKey?: string | null } | null>;
	headStorageKey?: (storageKey: string) => Promise<boolean>;
}): Promise<Issue[]> {
	try {
		const snapshot = await prepareSnapshot({
			collection: input.collection,
			slug: input.slug,
			metadata: input.metadata,
			mdx: input.mdx,
		} as ServiceInput);
		const mediaIds = [
			...new Set(snapshot.imageSources.map((s) => s.mediaId).filter((v): v is string => typeof v === "string")),
		];
		const media: ResolvedTargets["media"] = [];
		for (const id of mediaIds) {
			const row = await input.getMediaAsset(id);
			if (row) media.push({ id, status: row.status, storageKey: row.storageKey ?? null });
		}
		const warnings = [...(snapshot.warnings ?? []), ...imageWarnings(snapshot.imageSources, media)];
		if (input.headStorageKey) {
			const byId = new Map(media.map((row) => [row.id, row]));
			for (const source of snapshot.imageSources) {
				const row = source.mediaId ? byId.get(source.mediaId) : undefined;
				if (row?.status !== "ready" || !row.storageKey) continue;
				const exists = await input.headStorageKey(row.storageKey).catch(() => true);
				if (!exists) {
					warnings.push({ code: "image_media_missing_in_storage", message: row.storageKey, position: source.position });
				}
			}
		}
		return warnings;
	} catch {
		return [];
	}
}

export function validateForPublish(
	snapshot: PreparedSnapshot,
	resolved: ResolvedTargets,
): { ready: boolean; issues: Issue[]; warnings: Issue[] } {
	const issues: Issue[] = [...snapshot.issues];
	const occurrenceIssue = (code: string, occurrence: ReferenceOccurrence | undefined, message?: string): Issue => ({
		code,
		...(message ? { message } : {}),
		...(occurrence?.type === "mdx"
			? { position: { line: occurrence.line, column: occurrence.column } }
			: occurrence?.type === "metadata"
				? { path: occurrence.path, ...(occurrence.ordinal === undefined ? {} : { ordinal: occurrence.ordinal }) }
				: {}),
	});

	issues.push(
		...missingRequiredIssues(snapshot.collection, snapshot, { localizedOnly: Boolean(resolved.translation) }),
	);
	if (resolved.translation && !resolved.translation.sourcePublished) {
		// 공개 화면의 카테고리·태그·발행일은 원문에서 온다.
		issues.push({ code: "source_not_published", path: "translationGroupId" });
	}
	// 본문을 쓰는 컬렉션(`body`)만 빈 본문을 막는다.
	if (schemaOf(snapshot.collection).body && snapshot.mdx.trim() === "") {
		issues.push({ code: "empty_body", path: "mdx", position: { line: 1, column: 1 } });
	}

	// 메타데이터 관계는 스냅샷의 참조 목록과 무관하게 항상 검사한다(호출자가 참조를 비워 보내도 새지 않게).
	const metadataRefs = new ReferenceCollector();
	addMetadataReferences(metadataRefs, snapshot.collection, snapshot.metadata);
	const occurrenceKey = (kind: string, target: string, o: ReferenceOccurrence) =>
		`${kind}|${target}|${JSON.stringify(o)}`;
	const seen = new Set(
		snapshot.references.flatMap((ref) => ref.occurrences.map((o) => occurrenceKey(ref.kind, ref.targetId, o))),
	);
	const references: Reference[] = [...snapshot.references];
	for (const ref of metadataRefs.refs) {
		const missing = ref.occurrences.filter((o) => !seen.has(occurrenceKey(ref.kind, ref.targetId, o)));
		if (missing.length > 0) references.push({ ...ref, occurrences: missing });
	}

	for (const ref of references) {
		const occurrences = ref.occurrences.length > 0 ? ref.occurrences : [undefined];
		const addForAll = (code: string) => {
			for (const occurrence of occurrences) issues.push(occurrenceIssue(code, occurrence, ref.targetId));
		};

		if (ref.kind === "media") {
			if (!resolved.media.some((m) => m.id === ref.targetId)) addForAll("unresolved_media");
			continue;
		}

		const target = resolved.targets.find((t) => t.id === ref.targetId);
		if (!target) {
			addForAll("unresolved_reference");
			continue;
		}
		// 기대 대상 컬렉션과 미공개 허용은 관계 필드 정의에서 온다. 필드에 딸리지 않은 참조는 컬렉션을 따지지 않는다.
		const rule = ref.occurrences
			.map((o) => (o.type === "metadata" ? relationRule(snapshot.collection, o.path) : undefined))
			.find((found) => found !== undefined);
		if (rule && target.collection !== rule.to) {
			addForAll("invalid_reference_collection");
			continue;
		}
		// 모음집은 아직 공개되지 않은 게시글도 담을 수 있다(§6.4). 공개 목록에서만 뺀다.
		if (!target.isPublished && !rule?.allowUnpublished) addForAll("unpublished_reference");
	}

	for (const [index, source] of (snapshot.internalLinks ?? []).entries()) {
		const target = resolved.internalLinks?.[index];
		if (!target || target.addressType === "missing" || target.addressType === "deleted") {
			issues.push({ code: "unresolved_internal_link", message: source.url, path: "mdx", position: source.position });
		} else if (target.addressType === "reservation" || !target.isPublished) {
			issues.push({ code: "unpublished_internal_link", message: source.url, path: "mdx", position: source.position });
		}
	}

	// 이미지 해석 실패와 정의에 없는 속성은 경고일 뿐이다 — `ready`를 바꾸지 않는다.
	return {
		ready: issues.length === 0,
		issues,
		warnings: [...(snapshot.warnings ?? []), ...imageWarnings(snapshot.imageSources, resolved.media)],
	};
}
