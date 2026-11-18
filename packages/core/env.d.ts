declare namespace NodeJS {
	interface ProcessEnv {
		readonly NODE_ENV?: "development" | "production" | "test";
		readonly TEST_DATABASE_URL?: string;
	}
}
