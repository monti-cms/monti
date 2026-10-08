/** The name under which the plugin is found in the site config's `plugins`. */
export const GIT_SYNC_PLUGIN_NAME = "git-sync";
/** The file path pattern when a target gives none. */
export const DEFAULT_PATH_PATTERN = "{collection}/{slug}.{locale}.{ext}";
export const DEFAULT_FORMAT = "mdx";
export const DEFAULT_BRANCH = "main";
/** The branch `"pr"` mode commits to and opens its pull request from. */
export const DEFAULT_PR_BRANCH = "monti/publish";
export const DEFAULT_DEBOUNCE_MS = 2000;
const NAME = /^[a-z][a-z0-9-]*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PLACEHOLDERS = ["collection", "slug", "locale", "id", "ext"];
const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, "");
/** Front matter keys git-sync writes itself; a collection field with one of these names would be lost in the file. */
export const RESERVED_FRONT_MATTER_KEYS = ["slug", "date", "lastmod", "monti"];
/** The placeholders a pattern uses. */
export const patternPlaceholders = (pattern) => [...pattern.matchAll(/\{([a-z]+)\}/g)].map((match) => match[1] ?? "");
/** The default id of a target. */
const defaultId = (repo, folder) => [repo.replace("/", "-"), ...(folder ? [folder.replace(/\//g, "-")] : [])]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^[^a-z]+/, "t-");
/** Fills in the defaults of a target. Throws what is wrong with it, naming the target. */
export function resolveTarget(target, index) {
    const label = `git-sync target #${index + 1}${target.repo ? ` (${target.repo})` : ""}`;
    if (typeof target.repo !== "string" || !REPO.test(target.repo)) {
        throw new Error(`${label}: \`repo\` must be "owner/name"`);
    }
    if (!Array.isArray(target.collections) || target.collections.length === 0) {
        throw new Error(`${label}: \`collections\` must list at least one collection`);
    }
    const folder = trimSlashes(target.folder ?? "");
    if (folder.split("/").some((part) => part === ".." || part === ".")) {
        throw new Error(`${label}: \`folder\` cannot contain "." or ".." segments`);
    }
    const id = target.id ?? defaultId(target.repo, folder);
    if (!NAME.test(id))
        throw new Error(`${label}: the id "${id}" must be lowercase letters, digits and "-", starting with a letter`);
    const path = target.path ?? DEFAULT_PATH_PATTERN;
    if (path.startsWith("/") ||
        path.endsWith("/") ||
        path.split("/").some((part) => part === "" || part === ".." || part === ".")) {
        throw new Error(`${label}: \`path\` must be a relative file path pattern such as "${DEFAULT_PATH_PATTERN}"`);
    }
    const used = patternPlaceholders(path);
    const unknown = used.find((name) => !PLACEHOLDERS.includes(name));
    if (unknown)
        throw new Error(`${label}: \`path\` has the unknown placeholder {${unknown}} (use ${PLACEHOLDERS.map((name) => `{${name}}`).join(", ")})`);
    if (!used.includes("slug") && !used.includes("id")) {
        throw new Error(`${label}: \`path\` must contain {slug} or {id}, or two entries would share a file`);
    }
    const mode = target.mode ?? "commit";
    if (mode !== "commit" && mode !== "pr")
        throw new Error(`${label}: \`mode\` must be "commit" or "pr"`);
    const branch = target.branch ?? DEFAULT_BRANCH;
    const prBranch = target.prBranch ?? DEFAULT_PR_BRANCH;
    if (mode === "pr" && prBranch === branch)
        throw new Error(`${label}: \`prBranch\` must differ from \`branch\``);
    return {
        id,
        repo: target.repo,
        branch,
        folder,
        format: target.format ?? DEFAULT_FORMAT,
        path,
        collections: target.collections,
        mode,
        prBranch,
        ...(target.apiUrl ? { apiUrl: target.apiUrl } : {}),
    };
}
/** Every target with its defaults, after checking the list as a whole (ids are unique). */
export function resolveTargets(options) {
    const given = options.targets ?? [];
    if (!Array.isArray(given))
        throw new Error("git-sync: `targets` must be a list");
    const targets = given.map(resolveTarget);
    const seen = new Set();
    for (const target of targets) {
        if (seen.has(target.id))
            throw new Error(`git-sync: two targets share the id "${target.id}"; give each its own \`id\``);
        seen.add(target.id);
    }
    if (options.debounceMs !== undefined && (!Number.isFinite(options.debounceMs) || options.debounceMs < 0)) {
        throw new Error("git-sync: `debounceMs` must be 0 or more");
    }
    return targets;
}
/**
 * The checks that need the site (they run when the site config is created): the collections exist, the path pattern carries what the site needs to tell
 * files apart, and no field of a synced collection has the name of a front matter key git-sync writes itself.
 */
export function validateGitSyncConfig(options, config) {
    if (options.enabled === false)
        return;
    for (const target of resolveTargets(options)) {
        const used = patternPlaceholders(target.path);
        for (const collection of target.collections) {
            const schema = config.collections[collection];
            if (!schema)
                throw new Error(`git-sync target "${target.id}": there is no collection "${collection}"`);
            const clash = RESERVED_FRONT_MATTER_KEYS.find((key) => Object.hasOwn(schema.fields, key) && schema.fields[key].kind !== "slug");
            if (clash) {
                throw new Error(`git-sync target "${target.id}": field "${clash}" of collection "${collection}" has the name of a front matter key git-sync writes itself; rename the field`);
            }
        }
        if (target.collections.length > 1 && !used.includes("collection") && !used.includes("id")) {
            throw new Error(`git-sync target "${target.id}": \`path\` needs {collection} (or {id}) because the target has more than one collection`);
        }
        if (config.locales.length > 1 && !used.includes("locale") && !used.includes("id")) {
            throw new Error(`git-sync target "${target.id}": \`path\` needs {locale} (or {id}) because the site has more than one language`);
        }
    }
}
