import type { ResolvedTarget } from "./options";

/** What a file path says about the entry it holds. A part the pattern has no placeholder for is absent. */
export interface PathParts {
	readonly collection?: string;
	readonly slug?: string;
	readonly locale?: string;
	readonly id?: string;
}

/** What a path is built from. */
export interface PathValues {
	readonly collection: string;
	readonly slug: string;
	readonly locale: string;
	readonly id: string;
}

export interface PathPattern {
	/** The repo-relative path of an entry (the folder in front). */
	render(values: PathValues): string;
	/** The parts a repo path says, or `null` when the path is not one this pattern produces (outside the folder, other extension, unknown collection or language). */
	parse(path: string): PathParts | null;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export interface PathPatternOptions {
	readonly target: Pick<ResolvedTarget, "folder" | "path" | "collections">;
	/** Language codes of the site. */
	readonly locales: readonly string[];
	/** The format's file extension, without the dot. */
	readonly extension: string;
}

/** Compiles the path pattern of a target. `render` and `parse` are inverses for every path the pattern produces. */
export function createPathPattern({ target, locales, extension }: PathPatternOptions): PathPattern {
	const folder = target.folder ? `${target.folder}/` : "";
	const groups: string[] = [];
	let source = "";
	let last = 0;
	for (const match of target.path.matchAll(/\{([a-z]+)\}/g)) {
		source += escapeRegExp(target.path.slice(last, match.index));
		last = (match.index ?? 0) + match[0].length;
		const name = match[1] ?? "";
		groups.push(name);
		switch (name) {
			case "collection":
				source += `(${target.collections.map(escapeRegExp).join("|")})`;
				break;
			case "locale":
				source += `(${locales.map(escapeRegExp).join("|")})`;
				break;
			case "slug":
				source += "([^/]+?)";
				break;
			case "id":
				source += `(${UUID})`;
				break;
			case "ext":
				source += escapeRegExp(extension);
				groups.pop();
				break;
		}
	}
	source += escapeRegExp(target.path.slice(last));
	const regex = new RegExp(`^${escapeRegExp(folder)}${source}$`);

	return {
		render: (values) =>
			`${folder}${target.path.replace(/\{([a-z]+)\}/g, (_all, name: string) =>
				name === "ext" ? extension : (values[name as keyof PathValues] ?? ""),
			)}`,
		parse: (path) => {
			const found = regex.exec(path);
			if (!found) return null;
			const parts: { -readonly [K in keyof PathParts]: PathParts[K] } = {};
			groups.forEach((name, index) => {
				const value = found[index + 1];
				if (value !== undefined && (name === "collection" || name === "slug" || name === "locale" || name === "id")) {
					parts[name] = value;
				}
			});
			return parts;
		},
	};
}
