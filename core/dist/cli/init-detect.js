import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseJsonc } from "./config-paths.js";
import { defaultFirst, isLanguageCode, localesFromFileNames, normalizeLanguageCode, } from "./locale-names.js";
/** The package manager of the app, by its lockfile, then its `packageManager` field; `npm` when neither says. */
export function detectPackageManager(cwd) {
    const lockfiles = [
        ["pnpm-lock.yaml", "pnpm"],
        ["yarn.lock", "yarn"],
        ["bun.lock", "bun"],
        ["bun.lockb", "bun"],
        ["package-lock.json", "npm"],
    ];
    for (const [file, manager] of lockfiles)
        if (existsSync(path.join(cwd, file)))
            return manager;
    const manifest = path.join(cwd, "package.json");
    const field = (existsSync(manifest)
        ? parseJsonc(readFileSync(manifest, "utf8"))
        : undefined)?.packageManager;
    const named = typeof field === "string" ? field.split("@")[0] : undefined;
    return named === "pnpm" || named === "yarn" || named === "bun" ? named : "npm";
}
export const NEXT_CONFIG_FILES = ["next.config.ts", "next.config.mjs", "next.config.js"];
/** Folders searched for Markdown and MDX (each, and the folders up to {@link MAX_DEPTH} levels under it). */
const CONTENT_ROOTS = ["content", "src/content", "posts", "src/posts", "_posts", "blog", "src/blog", "data"];
const MAX_DEPTH = 3;
/** Files read per folder for front matter keys. */
export const SAMPLE_FILES = 50;
const SKIP_FOLDERS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const MARKDOWN = /\.(md|mdx)$/i;
const posix = (file) => file.split(path.sep).join("/");
/** The `key: value` lines at the top level of a front matter block (`---` fenced) as key -> type. Empty when the file has none. */
export function parseFrontMatterKeys(text) {
    const keys = new Map();
    const lines = text.replace(/^﻿/, "").split(/\r?\n/);
    if (lines[0]?.trim() !== "---")
        return keys;
    for (let index = 1; index < lines.length; index++) {
        const line = lines[index] ?? "";
        if (line.trim() === "---")
            break;
        const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (!match)
            continue;
        const [, name = "", rawValue = ""] = match;
        const value = rawValue.trim().replace(/\s+#.*$/, "");
        let type = "string";
        if (value === "" && /^\s*-\s/.test(lines[index + 1] ?? ""))
            type = "list";
        else if (value.startsWith("["))
            type = "list";
        else if (/^(true|false)$/i.test(value))
            type = "boolean";
        else if (/^-?\d+(\.\d+)?$/.test(value))
            type = "number";
        else if (/^["']?\d{4}-\d{2}-\d{2}/.test(value))
            type = "date";
        keys.set(name, type);
    }
    return keys;
}
/** Folders under the content roots that hold Markdown or MDX files, with the front matter keys of their files. */
function findContentFolders(cwd) {
    const folders = [];
    const names = new Map();
    const seen = new Set();
    const visit = (dir, depth) => {
        if (seen.has(dir))
            return;
        seen.add(dir);
        let entries;
        try {
            entries = readdirSync(path.join(cwd, dir), { withFileTypes: true });
        }
        catch {
            return;
        }
        const files = entries.filter((entry) => entry.isFile() && MARKDOWN.test(entry.name)).map((entry) => entry.name);
        if (files.length > 0) {
            const tally = new Map();
            for (const file of files.slice(0, SAMPLE_FILES)) {
                let text = "";
                try {
                    text = readFileSync(path.join(cwd, dir, file), "utf8");
                }
                catch {
                    continue;
                }
                for (const [name, type] of parseFrontMatterKeys(text)) {
                    const entry = tally.get(name) ?? { count: 0, types: new Map() };
                    entry.count++;
                    entry.types.set(type, (entry.types.get(type) ?? 0) + 1);
                    tally.set(name, entry);
                }
            }
            const keys = [...tally.entries()]
                .map(([name, { count, types }]) => ({
                name,
                count,
                type: [...types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "string",
            }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
            names.set(posix(dir), files);
            const locales = localesFromFileNames(files);
            folders.push({
                dir: posix(dir),
                files: files.length,
                keys,
                ...(locales ? { locales, localesFrom: "filename" } : {}),
            });
        }
        if (depth >= MAX_DEPTH)
            return;
        for (const entry of entries) {
            if (entry.isDirectory() && !SKIP_FOLDERS.has(entry.name) && !entry.name.startsWith(".")) {
                visit(path.join(dir, entry.name), depth + 1);
            }
        }
    };
    for (const root of CONTENT_ROOTS) {
        if (existsSync(path.join(cwd, root)) && statSync(path.join(cwd, root)).isDirectory())
            visit(root, 0);
    }
    return mergeLocaleFolders(folders, names);
}
/**
 * Sibling folders named after languages (`content/ko`, `content/en`) are one set of posts in two languages, not two collections: they are merged into their parent,
 * which then lists the languages. A single folder named like a language is left alone (it may be a name).
 */
function mergeLocaleFolders(folders, names) {
    const byParent = new Map();
    for (const folder of folders) {
        const base = path.posix.basename(folder.dir);
        const parent = path.posix.dirname(folder.dir);
        if (parent === "." || !isLanguageCode(base))
            continue;
        byParent.set(parent, [...(byParent.get(parent) ?? []), folder]);
    }
    let result = folders;
    for (const [parent, children] of byParent) {
        if (children.length < 2)
            continue;
        const stems = (folder) => new Set((names.get(folder.dir) ?? []).map((name) => name.replace(/\.(md|mdx)$/i, "").toLowerCase()));
        const stemSets = children.map(stems);
        const locales = defaultFirst(children.map((folder, index) => ({
            code: normalizeLanguageCode(path.posix.basename(folder.dir)),
            files: folder.files,
            unpaired: [...(stemSets[index] ?? [])].filter((stem) => !stemSets.some((other, otherIndex) => otherIndex !== index && other.has(stem))).length,
        })));
        const own = folders.find((folder) => folder.dir === parent);
        const members = [...(own ? [own] : []), ...children];
        const tally = new Map();
        for (const member of members) {
            for (const key of member.keys) {
                const entry = tally.get(key.name) ?? { count: 0, types: new Map() };
                entry.count += key.count;
                entry.types.set(key.type, (entry.types.get(key.type) ?? 0) + key.count);
                tally.set(key.name, entry);
            }
        }
        const merged = {
            dir: parent,
            files: members.reduce((sum, member) => sum + member.files, 0),
            keys: [...tally.entries()]
                .map(([name, { count, types }]) => ({
                name,
                count,
                type: [...types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "string",
            }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
            locales,
            localesFrom: "folder",
        };
        const drop = new Set(members);
        const first = result.findIndex((folder) => drop.has(folder));
        result = result.flatMap((folder, index) => (index === first ? [merged] : drop.has(folder) ? [] : [folder]));
    }
    return result;
}
/** Whether a `.gitignore` line list covers `.env.local`. */
export function ignoresEnvLocal(gitignore) {
    return gitignore
        .split(/\r?\n/)
        .map((line) => line.trim())
        .some((line) => [".env.local", ".env*.local", ".env*", ".env", "*.local", ".env.*"].includes(line));
}
/** Reads the app in `cwd`. Throws when there is no package.json. */
export function detectApp(cwd) {
    const packageFile = path.join(cwd, "package.json");
    if (!existsSync(packageFile)) {
        throw new Error("package.json not found; run `monti init` in the folder of your Next app");
    }
    const pkg = (parseJsonc(readFileSync(packageFile, "utf8")) ?? {});
    const dependencies = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
    const exists = (file) => existsSync(path.join(cwd, file));
    const src = exists("src/app") || (exists("src") && !exists("app"));
    const appDir = exists("src/app") ? "src/app" : exists("app") ? "app" : src ? "src/app" : "app";
    const tsconfig = exists("tsconfig.json")
        ? parseJsonc(readFileSync(path.join(cwd, "tsconfig.json"), "utf8"))
        : undefined;
    const compilerOptions = tsconfig
        ?.compilerOptions;
    const configRoots = src ? ["src/", ""] : [""];
    const dev = typeof pkg.scripts?.dev === "string" ? pkg.scripts.dev : "";
    const port = /(?:-p|--port)[ =]+(\d{2,5})/.exec(dev)?.[1];
    const gitignore = exists(".gitignore") ? readFileSync(path.join(cwd, ".gitignore"), "utf8") : "";
    return {
        cwd,
        packageName: typeof pkg.name === "string" ? pkg.name : undefined,
        next: pkg.dependencies?.next ?? pkg.devDependencies?.next,
        appDir,
        src,
        hasAppRouter: exists("app") || exists("src/app"),
        pagesRouterOnly: !(exists("app") || exists("src/app")) && (exists("pages") || exists("src/pages")),
        packageManager: detectPackageManager(cwd),
        typescript: exists("tsconfig.json") || dependencies.has("typescript"),
        resolveJsonModule: tsconfig === undefined ? undefined : compilerOptions?.resolveJsonModule === true,
        contentFolders: findContentFolders(cwd),
        nextConfig: NEXT_CONFIG_FILES.find(exists),
        devPort: port ? Number(port) : 3000,
        dependencies,
        legacyConfig: configRoots
            .flatMap((root) => ["cms.config.ts", "cms.server.ts"].map((file) => `${root}${file}`))
            .filter(exists),
        existingConfig: configRoots.map((root) => `${root}monti.config.ts`).find(exists),
        envLocalIgnored: ignoresEnvLocal(gitignore),
    };
}
