import { withCms } from "@monti-cms/core/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// 이 예시는 블로그 저장소 안에 있어 Next가 저장소 루트를 앱 루트로 잡지 않게 한다.
	turbopack: { root: import.meta.dirname },
};

export default withCms(nextConfig, { config: "./cms.config.ts", server: "./cms.server.ts" });
