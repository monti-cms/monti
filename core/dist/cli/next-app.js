import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseJsonc } from "./jsonc.js";
import { codeOf } from "./source-text.js";
/** The `package.json` of the app in `cwd` (read as JSON with comments, like the other files of the app), or `undefined` when there is none or it cannot be read. */
export function readPackageJson(cwd) {
    const file = path.join(cwd, "package.json");
    if (!existsSync(file))
        return undefined;
    const parsed = parseJsonc(readFileSync(file, "utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
}
/** The version range `package.json` lists for a package, in `dependencies` or `devDependencies`. */
export const dependencySpec = (pkg, name) => pkg?.dependencies?.[name] ?? pkg?.devDependencies?.[name];
/** The names of all the packages `package.json` lists. */
export const dependencyNames = (pkg) => new Set([...Object.keys(pkg?.dependencies ?? {}), ...Object.keys(pkg?.devDependencies ?? {})]);
/** Whether the folder is a Next app: `next` is in its package.json. */
export const isNextApp = (cwd) => dependencySpec(readPackageJson(cwd), "next") !== undefined;
// ---- the folders and files of the app ----
/** The next config files Monti can edit, in the order it looks. */
export const NEXT_CONFIG_FILES = ["next.config.ts", "next.config.mjs", "next.config.js"];
/** The next config files Monti cannot edit, and must not create a second one next to. */
export const OTHER_NEXT_CONFIG_FILES = ["next.config.cjs", "next.config.mts", "next.config.cts"];
const ROOT_LAYOUT_NAMES = ["layout.tsx", "layout.jsx", "layout.ts", "layout.js"];
const FILE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
const exists = (cwd, file) => existsSync(path.join(cwd, file));
/** The next config file of the app (relative to `cwd`), if there is one Monti can edit. */
export const findNextConfig = (cwd) => NEXT_CONFIG_FILES.find((file) => exists(cwd, file));
/** A next config file Monti cannot edit, if the app has one. */
export const findOtherNextConfig = (cwd) => OTHER_NEXT_CONFIG_FILES.find((file) => exists(cwd, file));
/**
 * The App Router folder of the app in `cwd`: `src/app` when it exists, else `app` when it exists, else the folder `init` would create (`src/app` when the
 * project keeps its code in `src/`, which is the case when `src/` exists and `app/` does not). `src` says whether the project keeps its code in `src/`.
 */
export function detectAppDir(cwd) {
    if (exists(cwd, "src/app"))
        return { dir: "src/app", exists: true, src: true };
    if (exists(cwd, "app"))
        return { dir: "app", exists: true, src: false };
    const src = exists(cwd, "src");
    return { dir: src ? "src/app" : "app", exists: false, src };
}
/** The root layout of the App Router (relative to `cwd`, with `/`), or `undefined` when there is none. */
export function findRootLayout(cwd) {
    const folders = exists(cwd, "src/app") ? ["src/app"] : ["app", "src/app"];
    for (const folder of folders)
        for (const name of ROOT_LAYOUT_NAMES)
            if (exists(cwd, `${folder}/${name}`))
                return `${folder}/${name}`;
    return undefined;
}
// ---- the wiring of a next.config and a root layout ----
/** Whether the file imports `withCms` from `@monti-cms/nextjs` (a comment that says so does not count). */
export function importsWithCms(text) {
    const code = codeOf(text);
    return (/\bimport\s*(?:type\s*)?\{[^}]*\bwithCms\b[^}]*\}\s*from\s*["']@monti-cms\/nextjs(?:\/config)?["']/.test(code) ||
        /\{[^}]*\bwithCms\b[^}]*\}\s*=\s*require\(\s*["']@monti-cms\/nextjs(?:\/config)?["']\s*\)/.test(code));
}
/** Whether a `next.config` file imports `withCms` from `@monti-cms/nextjs` and calls it. `monti init` and `monti doctor` agree on whether the config is wrapped. */
export function usesWithCms(text) {
    return importsWithCms(text) && /\bwithCms\s*\(/.test(codeOf(text));
}
/** The opening `<html ...>` tag of a layout's text: where it starts, the attributes, and what closes it (`>` or `/>`). */
const HTML_TAG = /<html\b([^>]*?)(\s*)(\/?)>/;
/** The `<html>` tag of a layout: its text, where it starts and its attributes; `undefined` when the text has no `<html>` tag (a nested layout). */
export function findHtmlTag(text) {
    const match = HTML_TAG.exec(text);
    if (!match)
        return undefined;
    const start = match.index ?? 0;
    return {
        start,
        end: start + match[0].length,
        attributes: match[1] ?? "",
        gap: match[2] ?? "",
        closer: `${match[3] ?? ""}>`,
    };
}
/** What the attributes of an `<html>` tag say about `suppressHydrationWarning`: `on`, `off` (`={false}`), or `absent`. */
export function suppressHydrationState(attributes) {
    if (!/\bsuppressHydrationWarning\b/.test(attributes))
        return "absent";
    return /\bsuppressHydrationWarning\s*=\s*\{\s*false\s*\}/.test(attributes) ? "off" : "on";
}
/** Whether the `<html>` tag of a layout has `suppressHydrationWarning` (set, not `={false}`); `undefined` when the text has no `<html>` tag (a nested layout). */
export function hasSuppressHydrationWarning(text) {
    const tag = findHtmlTag(text);
    return tag === undefined ? undefined : suppressHydrationState(tag.attributes) === "on";
}
// ---- .gitignore ----
/** Lines of a `.gitignore` that cover `.env.local`. */
const ENV_LOCAL_LINES = [".env.local", ".env*.local", ".env*", ".env", "*.local", ".env.*"];
/** Lines of a `.gitignore` that cover the `.monti/` folder (where `monti db:migrate` writes its logs). */
const MONTI_FOLDER_LINES = [
    ".monti",
    ".monti/",
    "/.monti",
    "/.monti/",
    ".monti/*",
    ".monti/**",
    "/.monti/*",
    "/.monti/**",
];
const linesOf = (gitignore) => gitignore.split(/\r?\n/).map((line) => line.trim());
/** What a `.gitignore` keeps out of git, of the things Monti needs kept out. */
export function gitignoreCoverage(gitignore) {
    const lines = linesOf(gitignore);
    return {
        envLocal: lines.some((line) => ENV_LOCAL_LINES.includes(line)),
        montiFolder: lines.some((line) => MONTI_FOLDER_LINES.includes(line)),
    };
}
/** Whether a `.gitignore` covers `.env.local`. */
export const ignoresEnvLocal = (gitignore) => gitignoreCoverage(gitignore).envLocal;
/** The three Next files for an admin path (`/studio`). The same list says what `monti init` writes and what `monti doctor` looks for. */
export function montiNextFiles(adminPath) {
    const admin = adminPath.split("/").filter(Boolean);
    const folder = (segments) => `/${segments.join("/")}`;
    return [
        {
            id: "layout",
            what: "admin layout",
            base: "layout",
            extension: "tsx",
            segments: admin,
            route: adminPath,
            marker: "CmsAdminLayout",
        },
        {
            id: "page",
            what: "admin page",
            base: "page",
            extension: "tsx",
            segments: [...admin, "[[...path]]"],
            route: folder([...admin, "[[...path]]"]),
            marker: "CmsAdminPage",
        },
        {
            id: "route",
            what: "API route",
            base: "route",
            extension: "ts",
            segments: ["api", "monti", "[...path]"],
            route: "/api/monti/[...path]",
            marker: "createRouteHandler",
        },
    ];
}
/** Where `monti init` writes a Next file: under the app folder (`src/app/studio/layout.tsx`). */
export const montiNextFilePath = (appDir, file) => `${appDir}${file.route === "/" ? "" : file.route}/${file.base}.${file.extension}`;
const isRouteGroup = (name) => /^\(.+\)$/.test(name);
/** The file for a route (`segments` after the app folder, route groups are transparent), or `undefined`. `base` is the file name without extension. */
export function findRouteFile(cwd, appDir, segments, base) {
    const walk = (dir, rest) => {
        if (rest.length === 0) {
            for (const extension of FILE_EXTENSIONS) {
                if (exists(cwd, `${dir}/${base}.${extension}`))
                    return `${dir}/${base}.${extension}`;
            }
        }
        let entries;
        try {
            entries = readdirSync(path.join(cwd, dir), { withFileTypes: true });
        }
        catch {
            return undefined;
        }
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (isRouteGroup(entry.name)) {
                const found = walk(`${dir}/${entry.name}`, rest);
                if (found)
                    return found;
            }
            else if (rest[0] === entry.name) {
                const found = walk(`${dir}/${entry.name}`, rest.slice(1));
                if (found)
                    return found;
            }
        }
        return undefined;
    };
    return walk(appDir, segments);
}
/** The files under the app folder named `base` that use `marker`, with the route they serve (route groups removed). */
export function routesUsing(cwd, appDir, marker, base) {
    const found = [];
    const walk = (dir, depth) => {
        if (depth > 6)
            return;
        let entries;
        try {
            entries = readdirSync(path.join(cwd, dir), { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const full = `${dir}/${entry.name}`;
            if (entry.isDirectory()) {
                if (entry.name !== "node_modules")
                    walk(full, depth + 1);
            }
            else if (FILE_EXTENSIONS.some((extension) => entry.name === `${base}.${extension}`)) {
                try {
                    if (readFileSync(path.join(cwd, full), "utf8").includes(marker)) {
                        const route = path.posix
                            .dirname(full)
                            .slice(appDir.length)
                            .split("/")
                            .filter((part) => part && !isRouteGroup(part));
                        found.push({ file: full, route: `/${route.join("/")}` });
                    }
                }
                catch {
                    // unreadable: not a candidate
                }
            }
        }
    };
    walk(appDir, 0);
    return found;
}
