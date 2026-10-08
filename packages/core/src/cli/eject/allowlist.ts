/**
 * What `monti eject` may take into the site. This file is the only place that decides it.
 *
 * The principle: open what users touch, seal what core guards. The admin screens, the block extensions and the plugins' admin parts are UI that sites want to
 * change, so their source can be taken over. Storage, migrations and the write pipeline must keep receiving upgrades, so the packages that hold them are refused.
 */

export interface EjectablePackage {
	/** The npm name. */
	readonly name: string;
	/** The folder under `packages/` the source goes to. The `monti-` prefix keeps it clear of packages of the site's own. */
	readonly directory: string;
	/** Why this package is open. */
	readonly why: string;
}

/** The UI packages. Plugins that are not cleanly split into an admin part and a server part are taken whole. */
export const EJECTABLE_PACKAGES: readonly EjectablePackage[] = [
	{
		name: "@monti-cms/admin",
		directory: "monti-admin",
		why: "the admin screens, editor and styles",
	},
	{
		name: "@monti-cms/blocks",
		directory: "monti-blocks",
		why: "the block extensions: their editor views and their rendering",
	},
	{
		name: "@monti-cms/seo",
		directory: "monti-seo",
		why: "the search and share fields with their admin preview (the whole plugin: its admin and server parts are one package)",
	},
	{
		name: "@monti-cms/ai",
		directory: "monti-ai",
		why: "the AI actions and their admin screen (the whole plugin: its admin and server parts are one package)",
	},
];

/** Packages that are refused, and why. The first entry that matches wins. */
const SEALED: readonly { readonly match: (name: string) => boolean; readonly reason: string }[] = [
	{
		match: (name) => name === "@monti-cms/core",
		reason:
			"it holds the config, the stores, the migrations and the write pipeline, and those must keep receiving upgrades. To change how the admin looks or works, eject @monti-cms/admin",
	},
	{
		match: (name) => name === "@monti-cms/auth",
		reason: "it is login and session handling: a security fix must reach every site, so it stays an installed package",
	},
	{
		match: (name) => name === "@monti-cms/mdx",
		reason:
			"its server and format side reads and writes the stored document, and that must keep receiving upgrades. The editor screens for MDX are in @monti-cms/admin, which can be ejected",
	},
	{
		match: (name) => name === "@monti-cms/nextjs",
		reason:
			"it holds the route handlers and the proxy through which every write goes, so it stays an installed package",
	},
	{
		match: (name) => name.startsWith("@monti-cms/storage-"),
		reason: "it is a storage package (media and data), and storage must keep receiving upgrades",
	},
	{
		match: (name) => ["@monti-cms/git-sync", "@monti-cms/bareun"].includes(name),
		reason: "it is a data or server package without a UI of its own to edit, so it stays an installed package",
	},
	{
		match: (name) => name.startsWith("@monti-cms/syntax-"),
		reason:
			"it is part of the format side (how the stored document is read and written), which must keep receiving upgrades",
	},
];

export type Ejectability =
	| { readonly ok: true; readonly package: EjectablePackage }
	| { readonly ok: false; readonly reason: string };

/** The names of the packages that can be ejected, comma separated. */
export const ejectableNames = (): string => EJECTABLE_PACKAGES.map((entry) => entry.name).join(", ");

/** Whether a package can be ejected; when it cannot, the reason is a sentence for the person who typed the name. */
export function ejectability(name: string): Ejectability {
	const found = EJECTABLE_PACKAGES.find((entry) => entry.name === name);
	if (found) return { ok: true, package: found };
	const sealed = SEALED.find((entry) => entry.match(name));
	if (sealed) {
		return {
			ok: false,
			reason: `${name} cannot be ejected: ${sealed.reason}. Only UI packages can: ${ejectableNames()}.`,
		};
	}
	if (name.startsWith("@monti-cms/")) {
		return {
			ok: false,
			reason: `${name} cannot be ejected: it is not a UI package. Only these can: ${ejectableNames()}.`,
		};
	}
	return {
		ok: false,
		reason: `${name} is not a Monti package. \`monti eject\` takes the source of: ${ejectableNames()}.`,
	};
}
