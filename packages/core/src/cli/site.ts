import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** What `monti init` and `monti doctor` read of a site's folder. Reading only. */

/** The config files the `monti` command loads, in the order it looks for them. */
const CONFIG_NAMES = ["monti.config.ts", "monti.config.mjs", "monti.config.js"];
/** The site's config file, by the name the command would load. */
export const configFileOf = (cwd: string) => CONFIG_NAMES.find((name) => existsSync(path.join(cwd, name))) ?? null;

const SOURCES = ["tsx", "ts", "jsx", "js"];

/** A JSON file's value, or `null` when it is not there or is not JSON. A byte-order mark before it is not part of it. */
export function readJson(file: string): Record<string, unknown> | null {
	try {
		return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/** The folders from one up to the disk's root: where Node looks for a package, and where a workspace keeps what its packages share. */
function upward(from: string): string[] {
	const dirs: string[] = [];
	for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
		dirs.push(dir);
		if (path.dirname(dir) === dir) return dirs;
	}
}

/**
 * An installed package's `package.json`, found the way Node finds the package: in this folder's `node_modules`, or a folder's above it (a
 * workspace keeps its packages' dependencies at its root). Read from the file, since a package's `exports` need not let it be imported.
 */
export function installedPackage(cwd: string, name: string): Record<string, unknown> | null {
	for (const dir of upward(cwd)) {
		const found = readJson(path.join(dir, "node_modules", ...name.split("/"), "package.json"));
		if (found) return found;
	}
	return null;
}

/**
 * The first of these files in this folder or one above it, with the folder it is in. It looks no higher than the repository's root: a file
 * left in a home folder is not the site's.
 */
export function fileUpward(cwd: string, names: readonly string[]): { name: string; dir: string } | null {
	for (const dir of upward(cwd)) {
		const name = names.find((each) => existsSync(path.join(dir, each)));
		if (name) return { name, dir };
		if (existsSync(path.join(dir, ".git"))) return null;
	}
	return null;
}

/** The App Router's folder: `app`, or `src/app`. */
export function appFolder(cwd: string): string | null {
	return ["app", path.join("src", "app")].find((dir) => existsSync(path.join(cwd, dir))) ?? null;
}

/** A source file by its name without the extension (`page`, `layout`) in a folder. */
export const sourceIn = (dir: string, name: string) =>
	SOURCES.map((extension) => path.join(dir, `${name}.${extension}`)).find((file) => existsSync(file));

/** Every file under a folder with one of these names, skipping what a site does not write. */
function filesNamed(dir: string, name: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...filesNamed(full, name));
		else if (SOURCES.some((extension) => entry.name === `${name}.${extension}`)) found.push(full);
	}
	return found;
}

/** The address a folder of the App Router answers at: a route group (`(site)`) is no part of it. `app/(cms)/admin` is `/admin`. */
function addressOf(app: string, folder: string): string {
	const parts = path
		.relative(app, folder)
		.split(path.sep)
		.filter((part) => part !== "" && !/^\(.*\)$/.test(part));
	return `/${parts.join("/")}`;
}

/**
 * Where the admin is mounted: the folder that holds the admin's page, with its API route under `api/[...path]`, wherever in the app it is (in
 * a route group, under another folder). Its address is the folder's (doc 16).
 */
export function adminFolder(cwd: string): { folder: string; page: string | null; address: string } | null {
	const app = appFolder(cwd);
	if (!app) return null;
	const route = filesNamed(path.join(cwd, app), "route").find((file) =>
		readFileSync(file, "utf8").includes("adminRoute"),
	);
	if (!route) return null;
	// <admin>/api/[...path]/route.ts
	const folder = path.relative(cwd, path.dirname(path.dirname(path.dirname(route))));
	return { folder, page: sourceIn(path.join(cwd, folder), "page") ?? null, address: addressOf(app, folder) };
}

/** The pages of the site that answer at an address, whatever route group they are in. */
export function pagesAt(cwd: string, address: string): string[] {
	const app = appFolder(cwd);
	if (!app) return [];
	return filesNamed(path.join(cwd, app), "page")
		.map((file) => path.relative(cwd, file))
		.filter((file) => addressOf(app, path.dirname(file)) === address);
}

/** The layouts over a folder of the app, nearest first, not counting the top-level one (`app/layout`). */
export function layoutsOver(cwd: string, folder: string): string[] {
	const app = appFolder(cwd);
	if (!app) return [];
	const found: string[] = [];
	for (let dir = folder; dir !== app && dir.startsWith(app); dir = path.dirname(dir)) {
		const layout = sourceIn(path.join(cwd, dir), "layout");
		if (layout) found.push(path.relative(cwd, layout));
	}
	return found;
}
