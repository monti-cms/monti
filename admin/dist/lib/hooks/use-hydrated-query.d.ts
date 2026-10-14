import type { UseQueryResult } from "@tanstack/react-query";
/**
 * The query as it reads during hydration: pending, with no data and no error, until the page has hydrated; the real result afterwards.
 * A plugin page hydrates after the layout, so a query the layout also asks for (a slot provider) can already hold data when the page
 * hydrates, while the server HTML showed it loading. Reading the query through this keeps the first client render the same as the server's.
 */
export declare function useHydratedQuery<TData, TError>(query: UseQueryResult<TData, TError>): UseQueryResult<TData, TError>;
