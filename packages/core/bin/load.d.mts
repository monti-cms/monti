/** The loader of a site's `monti.config.ts` (jiti with the site's blocks readable): `loader.import(file, { default: true })`. */
export function createLoader(parent: string | URL): {
	import<T = unknown>(id: string, options?: { default?: boolean }): Promise<T>;
};
