import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHydratedQuery } from "../use-hydrated-query";

function List({
	read,
}: {
	read: (query: ReturnType<typeof useQuery<string[]>>) => ReturnType<typeof useQuery<string[]>>;
}) {
	const query = read(useQuery({ queryKey: ["items"], queryFn: async () => ["a", "b"] }));
	if (query.isPending) return <p>loading</p>;
	return (
		<ul>
			{query.data?.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

/** Server HTML from an empty cache, hydrated with a cache that already holds the list (another component fetched it first). */
async function hydrateWithCachedData(
	read: (query: ReturnType<typeof useQuery<string[]>>) => ReturnType<typeof useQuery<string[]>>,
) {
	const ui = (client: QueryClient) => (
		<QueryClientProvider client={client}>
			<List read={read} />
		</QueryClientProvider>
	);
	const container = document.createElement("div");
	container.innerHTML = renderToString(ui(new QueryClient()));
	document.body.append(container);
	const client = new QueryClient();
	client.setQueryData(["items"], ["a", "b"]);
	const recoverable = vi.fn();
	await act(async () => {
		hydrateRoot(container, ui(client), { onRecoverableError: recoverable });
	});
	return { container, recoverable };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("useHydratedQuery", () => {
	it("hydrates without a mismatch when the cache already holds the data, then shows it", async () => {
		const { container, recoverable } = await hydrateWithCachedData(useHydratedQuery);
		expect(recoverable).not.toHaveBeenCalled();
		expect(container.textContent).toBe("ab");
	});

	it("is needed: reading the cached query directly does not match the server HTML", async () => {
		const { recoverable } = await hydrateWithCachedData((query) => query);
		expect(recoverable).toHaveBeenCalled();
	});
});
