import { defineServerConfig, githubAuth, postgres } from "../src/server";
import { r2Storage } from "../src/storage/s3";

/**
 * 패키지 자체 테스트용 서버 설정. 저장소 테스트는 연결을 직접 만들고(`test-database.ts`), 이 설정은 연결 모음
 * (`container.ts`)을 거치는 코드가 읽는다. 테스트가 환경 변수를 바꿔 끼우므로 값은 읽을 때마다 환경에서 가져온다.
 */
export default defineServerConfig({
	database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL }),
	media: r2Storage({
		accessKeyId: undefined,
		secretAccessKey: undefined,
		bucket: undefined,
		endpoint: undefined,
		publicBaseUrl: undefined,
	}),
	auth: githubAuth({ clientId: undefined, clientSecret: undefined, adminIds: [] }),
	get secret() {
		return process.env.AUTH_SECRET;
	},
});
