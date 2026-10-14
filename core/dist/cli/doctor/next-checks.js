import { readFileSync } from "node:fs";
import path from "node:path";
import { detectAppDir, findNextConfig, findRootLayout, findRouteFile, hasSuppressHydrationWarning, isNextApp, montiNextFilePath, montiNextFiles, routesUsing, usesWithCms, } from "../next-app.js";
import { fail, ok, skip, warn } from "./outcome.js";
/** The `next` group of `monti doctor`: the three Next files, `withCms`, `suppressHydrationWarning` and the admin path. */
const nextFiles = {
    group: "next",
    id: "files",
    title: "The three Next files",
    needsCms: true,
    run: (state) => {
        if (!isNextApp(state.cwd))
            return skip("not checked: this folder is not a Next app (no `next` in package.json)");
        const detected = detectAppDir(state.cwd);
        const appDir = detected.dir;
        const adminPath = state.cms?.site.ADMIN_PATH ?? "/admin";
        const adminSegments = adminPath.split("/").filter(Boolean);
        if (!detected.exists) {
            return fail(`there is no ${appDir}/ folder, so there are no Next files`, {
                where: state.cwd,
                fix: `Monti needs the App Router: add a ${appDir}/ folder (it can sit next to pages/) and run \`monti init\``,
            });
        }
        const wanted = montiNextFiles(adminPath);
        const problems = [];
        const fixes = [];
        const found = [];
        for (const item of wanted) {
            const file = adminSegments.length === 0 && item.base === "layout"
                ? undefined
                : findRouteFile(state.cwd, appDir, item.segments, item.base);
            if (file) {
                if (!readFileSync(path.join(state.cwd, file), "utf8").includes(item.marker)) {
                    problems.push(`${file} exists but does not use ${item.marker}`);
                    fixes.push(`${file}: use ${item.marker} from @monti-cms/nextjs${item.base === "route" ? "" : "/admin"} (copy the file \`monti init\` writes)`);
                }
                else
                    found.push(file);
                continue;
            }
            problems.push(`${item.what} is missing (${appDir}${item.route})`);
            if (item.marker !== "createRouteHandler") {
                const elsewhere = routesUsing(state.cwd, appDir, item.marker, item.base)[0];
                if (elsewhere) {
                    fixes.push(`the ${item.what} is at ${elsewhere.file}, which serves ${elsewhere.route}, but the admin path in your config is ${adminPath}. Either set admin: { path: "${elsewhere.route}" } in monti.schema.ts, or move the folder to ${appDir}${adminPath}`);
                    continue;
                }
            }
            fixes.push(`create ${montiNextFilePath(appDir, item)} (\`monti init\` writes all three; it keeps files you already have)`);
        }
        return problems.length === 0
            ? ok(`found ${found.join(", ")}`)
            : fail(problems.join("; "), { where: `${appDir}/ (admin path ${adminPath})`, fix: fixes.join("\n") });
    },
};
const nextWithCms = {
    group: "next",
    id: "with-cms",
    title: "withCms in next.config",
    run: (state) => {
        if (!isNextApp(state.cwd))
            return skip("not checked: this folder is not a Next app (no `next` in package.json)");
        const file = findNextConfig(state.cwd);
        if (!file) {
            return fail("there is no next.config.ts", {
                where: state.cwd,
                fix: "run `monti init`, which creates next.config.ts with the withCms wrapper (withCms comes from the package @monti-cms/nextjs/config)",
            });
        }
        return usesWithCms(readFileSync(path.join(state.cwd, file), "utf8"))
            ? ok(`${file} wraps the config in withCms`)
            : fail(`${file} does not use withCms, so the build cannot transpile Monti's packages`, {
                where: file,
                fix: "run `monti init`, which wraps the export for you. By hand: import withCms from @monti-cms/nextjs/config and export `withCms(nextConfig)` instead of `nextConfig`",
            });
    },
};
const nextHydration = {
    group: "next",
    id: "hydration",
    title: "suppressHydrationWarning on <html>",
    run: (state) => {
        if (!isNextApp(state.cwd))
            return skip("not checked: this folder is not a Next app (no `next` in package.json)");
        const layout = findRootLayout(state.cwd);
        if (!layout)
            return skip("not checked: there is no root layout");
        const has = hasSuppressHydrationWarning(readFileSync(path.join(state.cwd, layout), "utf8"));
        if (has === undefined)
            return skip(`not checked: ${layout} has no <html> tag`);
        return has
            ? ok(`${layout} has suppressHydrationWarning on <html>`)
            : warn("the admin theme sets a class on <html> before React hydrates, so the first admin screen logs a hydration mismatch", {
                where: layout,
                fix: `run \`monti init\`, which adds it for you. By hand: <html lang="en" suppressHydrationWarning>`,
            });
    },
};
const adminPathCheck = {
    group: "next",
    id: "admin-path",
    title: "Admin path",
    needsCms: true,
    run: (state) => {
        const adminPath = state.cms?.site.ADMIN_PATH ?? "/admin";
        const site = state.env.SITE_URL?.trim().replace(/\/+$/, "");
        return ok(`the admin is at ${adminPath} ${site ? `(${site}${adminPath})` : "on your site (SITE_URL is not set)"}`, {
            where: 'admin.path in monti.schema.ts (default "/admin")',
        });
    },
};
/** The checks of the `next` group. */
export const NEXT_CHECKS = [nextFiles, nextWithCms, nextHydration, adminPathCheck];
