import type { ContentChange } from "../adapters/postgres/store/after-commit";
import { cmsConfig } from "../config/resolved";
import type { CmsServerConfig } from "../server/define";
import { cmsServerConfig } from "../server/resolved";
import type { CmsPlugin, CmsServerPlugin, OwnedPluginRoute, PluginDatabase } from "./define";

/** 사이트 설정의 플러그인. 플러그인이 없는 설정은 빈 튜플 타입이라 넓혀 읽는다. */
const PLUGINS: readonly CmsPlugin[] = cmsConfig.plugins ?? [];

/**
 * 사이트 설정의 플러그인 서버 쪽을 불러온다. 처음 부를 때 한 번 읽고 다시 쓴다.
 * 서버 쪽이 없는 플러그인은 빈 값이다. 불러오기가 실패하면 기억하지 않아 다음에 다시 시도하고, 오류는 그대로 던진다.
 */
let loaded: Promise<readonly (CmsServerPlugin & { readonly name: string })[]> | undefined;

export function loadServerPlugins(): Promise<readonly (CmsServerPlugin & { readonly name: string })[]> {
	loaded ??= Promise.all(
		PLUGINS.map(async (plugin) => ({ name: plugin.name, ...(await plugin.server?.())?.default })),
	).catch((error) => {
		loaded = undefined;
		console.error("[cms] failed to load plugin server modules", error);
		throw error;
	});
	return loaded;
}

/** 플러그인 API 경로표(플러그인 순서대로, 어느 플러그인 경로인지 붙인다). */
export async function pluginRoutes(): Promise<readonly OwnedPluginRoute[]> {
	return (await loadServerPlugins()).flatMap((plugin) =>
		(plugin.routes ?? []).map((route) => ({ ...route, plugin: plugin.name })),
	);
}

/** 플러그인이 쓰는 DB 연결. */
export const getCmsDatabase = (): PluginDatabase => cmsServerConfig.database.pluginDatabase();

/** 플러그인 표를 만든다. 본체 표를 만든 다음(`monti migrate`) 부른다. */
export async function migratePlugins(): Promise<void> {
	for (const plugin of await loadServerPlugins()) {
		if (!plugin.migrate) continue;
		console.log(`Migrating plugin "${plugin.name}"...`);
		await plugin.migrate(getCmsDatabase());
	}
}

/**
 * 플러그인이 메타 API에 더하는 기능 표시를 플러그인 이름 아래에 모은다(`{ ai: { … } }`).
 * 기능 표시가 없거나 실패한 플러그인은 뺀다.
 */
export async function pluginFeatures(): Promise<Record<string, Readonly<Record<string, boolean>>>> {
	const plugins = await loadServerPlugins();
	const entries = await Promise.all(
		plugins.map(async (plugin) => {
			if (!plugin.features) return undefined;
			try {
				return [plugin.name, await plugin.features()] as const;
			} catch {
				return undefined;
			}
		}),
	);
	return Object.fromEntries(entries.filter((entry) => entry !== undefined));
}

/** 서버 설정과 플러그인의 저장 뒤 알림을 차례로 부른다(하나가 실패해도 나머지는 부른다). */
export async function notifyAfterCommit(change: ContentChange): Promise<void> {
	const serverConfig: CmsServerConfig = cmsServerConfig;
	const hooks = [serverConfig.afterCommit, ...(await loadServerPlugins()).map((plugin) => plugin.afterCommit)];
	for (const hook of hooks) {
		if (!hook) continue;
		try {
			await hook(change);
		} catch (error) {
			console.error("[cms] afterCommit failed", change.kind, change.entryId, error);
		}
	}
}
