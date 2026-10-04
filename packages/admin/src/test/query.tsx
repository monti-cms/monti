import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/** 서버 데이터 캐시(react-query)를 쓰는 화면을 그린다. 테스트마다 새 캐시를 쓴다. */
export function renderWithQuery(ui: ReactElement) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
