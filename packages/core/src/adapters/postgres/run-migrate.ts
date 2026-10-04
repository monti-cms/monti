import { migratePlugins } from "../../plugin/server";
import { cmsServerConfig } from "../../server/resolved";

/**
 * 서버 설정(`cms.server.ts`)의 저장소에 표를 만들거나 최신 모양으로 맞춘다(플러그인 표 포함). 여러 번 돌려도 결과가 같다.
 * 명령줄 `monti migrate`가 부른다. 성공하면 `true`.
 */
export async function runMigrate(log: (message: string) => void = console.log): Promise<boolean> {
	const { database } = cmsServerConfig;
	log(`Starting CMS database migration (${database.name})...`);
	try {
		await database.migrate();
		await migratePlugins();
		log("CMS database migration completed successfully!");
		return true;
	} catch (err) {
		console.error("Migration failed:", err);
		return false;
	} finally {
		await database.close?.();
	}
}
