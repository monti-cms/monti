import { defineServerConfig, githubAuth, postgres } from "@monti-cms/core/server";

/**
 * 서버 설정(`monti init`이 만든 모양). 저장소와 관리자 로그인은 환경 변수에서 읽는다(`.env.local`). 미디어 저장소는 두지 않았다.
 * 로그인 API는 관리자 API 라우트가 함께 받는다(`/api/cms/auth/*`, 로그인 라우트 파일 없음). GitHub OAuth 앱의 콜백 주소는
 * `<사이트 주소>/api/cms/auth/callback/github`다.
 */
export default defineServerConfig({
	database: postgres({ connectionString: process.env.CMS_DATABASE_URL, schema: process.env.CMS_SCHEMA }),
	auth: githubAuth({
		clientId: process.env.AUTH_GITHUB_ID,
		clientSecret: process.env.AUTH_GITHUB_SECRET,
		adminIds: [process.env.CMS_ADMIN_GITHUB_ID],
		// 로컬 개발(`next dev`)에서만 로그인 없이 관리자로 본다.
		devBypass: process.env.CMS_DEV_AUTH_BYPASS === "1",
		secret: process.env.AUTH_SECRET,
	}),
	secret: process.env.CMS_SECRET,
});
