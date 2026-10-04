"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * 관리자 화면의 서버 데이터 캐시. 레이아웃에 두어 목록 ↔ 편집 화면을 오가도 캐시가 남는다.
 * 목록은 들어올 때마다 새로 받아 오되(`staleTime: 0`), 받아 오는 동안에도 이전 줄을 그대로 보인다.
 */
export function AdminQueryProvider({ children }: { children: ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { retry: 1, refetchOnWindowFocus: true },
				},
			}),
	);
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
