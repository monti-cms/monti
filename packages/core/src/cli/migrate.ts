import { register } from "node:module";
import path from "node:path";
import { CONFIG_ALIAS, resolveConfigPaths, SERVER_ALIAS } from "./config-paths";
import { loadEnvFiles } from "./env";

export interface MigrateOptions {
	readonly cwd: string;
	/** 읽을 환경 파일. 없으면 `.env.local`·`.env`(있는 것만), 빈 배열이면 읽지 않는다. */
	readonly envFiles?: readonly string[];
	readonly config?: string;
	readonly server?: string;
	readonly log?: (message: string) => void;
}

/**
 * `monti migrate`: 환경 파일을 읽고, 설정 별칭(`@cms-config`·`@cms-server`)을 앱의 파일로 이은 뒤 저장소에 표를 만든다.
 * TypeScript 설정 파일은 명령(`bin/monti.mjs`)이 먼저 건 tsx가 읽는다. 성공하면 `true`.
 */
export async function migrate(options: MigrateOptions): Promise<boolean> {
	const log = options.log ?? console.log;
	const loaded = loadEnvFiles(options.cwd, options.envFiles);
	if (loaded.length > 0) log(`env: ${loaded.join(", ")}`);
	const paths = resolveConfigPaths(options.cwd, { config: options.config, server: options.server });
	log(`config: ${paths.config} · server: ${paths.server}`);
	const hooks = new URL(
		import.meta.url.endsWith(".ts") ? "../register-hooks.ts" : "../register-hooks.js",
		import.meta.url,
	);
	register(hooks, {
		data: {
			aliases: {
				[CONFIG_ALIAS]: path.resolve(options.cwd, paths.config),
				[SERVER_ALIAS]: path.resolve(options.cwd, paths.server),
			},
		},
	});
	const { runMigrate } = await import("../adapters/postgres/run-migrate");
	return runMigrate(log);
}
