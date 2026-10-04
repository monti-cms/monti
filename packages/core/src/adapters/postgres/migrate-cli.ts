import { runMigrate } from "./run-migrate";

/**
 * 예전 진입점(`import "@monti-cms/core/migrate"`): 불러오면 바로 표를 만든다. 새 앱은 명령줄 `monti migrate`를 쓴다.
 *
 * ```sh
 * tsx --env-file=.env.local --import @monti-cms/core/register migrate.ts   # migrate.ts: import "@monti-cms/core/migrate";
 * ```
 */
void runMigrate().then((ok) => {
	if (!ok) process.exitCode = 1;
});
