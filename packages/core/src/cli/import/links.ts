import path from "node:path";
import { mapLinkAttrs } from "../../doc/entry-links";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import type { Site } from "../../site";
import { type FilePlan, groupId } from "./plan";

/**
 * Links between the imported files. A body links to another post by a relative file path (`./other.mdx`, `../posts/other`) or by a path of the old site
 * (`/blog/other`). Both are turned into links by entry id, which is how a stored document points to an entry.
 */

const norm = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const singular = (value: string) =>
	value.endsWith("ies")
		? `${value.slice(0, -3)}y`
		: value.endsWith("s") && !value.endsWith("ss")
			? value.slice(0, -1)
			: value;

const stripExtension = (file: string) => file.replace(/\.(md|mdx)$/i, "");

/** The files that can be the target of a link. */
export interface LinkIndex {
	readonly site: Site;
	/** By absolute path, extension included. */
	readonly byFile: ReadonlyMap<string, FilePlan>;
	/** By absolute path without extension and language: the posts of one name, in every language. */
	readonly byStem: ReadonlyMap<string, readonly FilePlan[]>;
	/** By address: the posts with this address, in every language. */
	readonly bySlug: ReadonlyMap<string, readonly FilePlan[]>;
}

/** The path of a post without extension and language. An `index` file stands for its folder: `hello/index.md` is `hello`. */
const stemOf = (plan: FilePlan): string =>
	plan.path.isIndex ? path.dirname(plan.source.abs) : path.join(path.dirname(plan.source.abs), plan.path.name);

export function buildLinkIndex(site: Site, plans: readonly FilePlan[]): LinkIndex {
	const byFile = new Map<string, FilePlan>();
	const byStem = new Map<string, FilePlan[]>();
	const bySlug = new Map<string, FilePlan[]>();
	for (const plan of plans) {
		if (!plan.collection || plan.errors.length > 0 || plan.skip) continue;
		byFile.set(plan.source.abs, plan);
		const key = stemOf(plan);
		byStem.set(key, [...(byStem.get(key) ?? []), plan]);
		bySlug.set(plan.slug, [...(bySlug.get(plan.slug) ?? []), plan]);
	}
	return { site, byFile, byStem, bySlug };
}

/** What a link turned out to be. */
export type LinkDecision =
	| { readonly kind: "keep" }
	| { readonly kind: "entry"; readonly target: FilePlan }
	| { readonly kind: "unresolved"; readonly reason: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** The member of a group a link should land on: the file's own language first, then the default one. The entry is the same group whichever is chosen. */
const pick = (plans: readonly FilePlan[], from: FilePlan, site: Site): FilePlan | undefined =>
	plans.find((plan) => plan.locale === from.locale) ??
	plans.find((plan) => plan.locale === site.DEFAULT_LOCALE) ??
	plans[0];

/** Decides what the link `href` of the file `from` points to. */
export function decideLink(href: string, from: FilePlan, index: LinkIndex): LinkDecision {
	const { site } = index;
	if (href === "" || href.startsWith("#")) return { kind: "keep" };
	let pathname: string;
	if (href.startsWith("//") || SCHEME.test(href)) {
		let url: URL;
		try {
			url = new URL(href.startsWith("//") ? `https:${href}` : href);
		} catch {
			return { kind: "keep" };
		}
		if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "keep" };
		const own = site.config.site?.url ? new URL(site.config.site.url).hostname : undefined;
		const hosts = new Set([own, ...(site.config.site?.aliases ?? [])].filter(Boolean));
		if (!hosts.has(url.hostname)) return { kind: "keep" };
		pathname = url.pathname;
	} else {
		const end = href.search(/[?#]/);
		pathname = end === -1 ? href : href.slice(0, end);
	}
	let decoded: string;
	try {
		decoded = decodeURI(pathname);
	} catch {
		return { kind: "keep" };
	}
	if (decoded === "") return { kind: "keep" };

	if (!decoded.startsWith("/") && !SCHEME.test(href) && !href.startsWith("//")) {
		const target = path.resolve(path.dirname(from.source.abs), decoded);
		const direct =
			index.byFile.get(target) ??
			index.byFile.get(`${target}.mdx`) ??
			index.byFile.get(`${target}.md`) ??
			index.byFile.get(path.join(target, "index.mdx")) ??
			index.byFile.get(path.join(target, "index.md"));
		if (direct)
			return { kind: "entry", target: pick(index.byStem.get(stemOf(direct)) ?? [direct], from, site) ?? direct };
		const sameName = index.byStem.get(stripExtension(target).replace(/\/+$/, ""));
		const chosen = sameName && pick(sameName, from, site);
		if (chosen) return { kind: "entry", target: chosen };
		if (/\.mdx?$/i.test(decoded)) {
			return { kind: "unresolved", reason: `${href} points to a file that is not among the imported files` };
		}
		if (path.extname(decoded) !== "") return { kind: "keep" };
	}
	return decideSitePath(decoded, href, from, index);
}

/** A path of the site (`/blog/other-post`): by the paths of the new site first, then by the last part against the addresses of the imported posts. */
function decideSitePath(pathname: string, href: string, from: FilePlan, index: LinkIndex): LinkDecision {
	const { site } = index;
	const segments = pathname
		.replace(/\.(html?|mdx?)$/i, "")
		.split("/")
		.filter((part) => part !== "" && part !== "." && part !== "..");
	const first = segments[0];
	if (first && segments.length > 1 && localeCode(first, site)) segments.shift();
	const slug = segments.at(-1);
	if (!slug) return { kind: "keep" };

	const known = site.parseContentPath(`/${segments.join("/")}`);
	const exact = known
		? (index.bySlug.get(known.slug) ?? []).filter((plan) => plan.collection === known.collection)
		: [];
	if (exact.length > 0) {
		const chosen = pick(exact, from, site);
		if (chosen) return { kind: "entry", target: chosen };
	}

	const candidates = index.bySlug.get(slug) ?? [];
	const groups = new Set(candidates.map((plan) => groupId(plan)));
	if (groups.size === 0) return { kind: "keep" };
	const parents = segments.slice(0, -1).map((part) => singular(norm(part)));
	const named = candidates.filter((plan) =>
		parents.some(
			(part) =>
				part === singular(norm(plan.folder === "." ? "" : plan.folder)) ||
				part === singular(norm(plan.collection ?? "")),
		),
	);
	const pool = named.length > 0 ? named : groups.size === 1 ? candidates : [];
	if (new Set(pool.map((plan) => groupId(plan))).size === 1) {
		const chosen = pick(pool, from, site);
		if (chosen) return { kind: "entry", target: chosen };
	}
	return { kind: "unresolved", reason: `${href} could match more than one imported post` };
}

function localeCode(value: string, site: Site): string | undefined {
	return site.LOCALES.find((code) => code.toLowerCase() === value.toLowerCase());
}

export interface RewrittenLinks {
	readonly doc: StoredDocument;
	/** The files this document links to that have no entry yet. The document is written again when they have one. */
	readonly pending: ReadonlySet<FilePlan>;
	/** Links that point to an imported-looking target that could not be found or told apart. */
	readonly unresolved: readonly string[];
	/** How many links became links by entry id. */
	readonly resolved: number;
	/** Links that had a `#fragment` or a `?query`, which a link by entry id cannot carry. */
	readonly droppedFragments: number;
}

/**
 * The document with the links to imported files turned into links by entry id. `idOf` gives the entry id (translation group id) of an imported file, or
 * `undefined` while it has none: that link is left as it is and the file is in `pending`.
 */
export function rewriteLinks(
	doc: StoredDocument,
	from: FilePlan,
	index: LinkIndex,
	idOf: (plan: FilePlan) => string | undefined,
): RewrittenLinks {
	const pending = new Set<FilePlan>();
	const unresolved: string[] = [];
	let resolved = 0;
	let droppedFragments = 0;
	const content = mapLinkAttrs(doc.content, (attrs) => {
		const href = typeof attrs.href === "string" ? attrs.href : undefined;
		if (href === undefined) return undefined;
		const decision = decideLink(href, from, index);
		if (decision.kind === "unresolved") {
			unresolved.push(decision.reason);
			return undefined;
		}
		if (decision.kind !== "entry") return undefined;
		const id = idOf(decision.target);
		if (!id) {
			pending.add(decision.target);
			return undefined;
		}
		resolved += 1;
		if (/[?#]/.test(href)) droppedFragments += 1;
		return { entryId: id };
	}) as readonly CmsNode[];
	return {
		doc: content === doc.content ? doc : { ...doc, content: [...content] },
		pending,
		unresolved,
		resolved,
		droppedFragments,
	};
}
