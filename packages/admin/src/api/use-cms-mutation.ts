import { type Site, useSite } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { errorText } from "./client";

/** An optimistic change: `update` rewrites every cached query under `queryKey`, and the old values come back if the call fails. */
export interface OptimisticUpdate<TData, TVariables> {
	queryKey: QueryKey;
	update: (data: TData, variables: TVariables) => TData;
}

export interface CmsMutationOptions<TVariables, TResult, TData = unknown> {
	/** The server call. */
	fn: (variables: TVariables, context: { site: Site }) => Promise<TResult>;
	/** Toast shown when the call succeeds. Return `undefined` for none. */
	success?: string | ((result: TResult, variables: TVariables) => string | undefined);
	/** Text shown when the call fails and the server gave none (the server's own message wins). It is a toast unless `inline` is set. */
	failure: string | ((variables: TVariables) => string);
	/** Queries refetched once the call settles, win or lose, so the screen ends up with what the server holds. */
	invalidate?: readonly QueryKey[] | ((result: TResult | undefined, variables: TVariables) => readonly QueryKey[]);
	/** Applied to the cache before the call and rolled back if it fails. */
	optimistic?: OptimisticUpdate<TData, TVariables> | readonly OptimisticUpdate<TData, TVariables>[];
	/** Do not toast a failure: the caller shows `mutation.error` (through `errorText`) where it belongs, or handles it in `onError`. */
	inline?: boolean;
	onSuccess?: (result: TResult, variables: TVariables) => void;
	onError?: (error: unknown, variables: TVariables) => void;
}

/**
 * A write to the server that owns the whole after-math: the optimistic change and its rollback, the success and failure toasts, and
 * the invalidation. A screen calls `mutate` / `mutateAsync` and keeps only what is its own (closing a dialog, moving the selection).
 */
export function useCmsMutation<TVariables = void, TResult = unknown, TData = unknown>(
	options: CmsMutationOptions<TVariables, TResult, TData>,
) {
	const site = useSite();
	const queryClient = useQueryClient();
	return useMutation<TResult, unknown, TVariables, { snapshots: [QueryKey, unknown][] }>({
		mutationFn: (variables) => options.fn(variables, { site }),
		onMutate: async (variables) => {
			const updates = options.optimistic === undefined ? [] : [options.optimistic].flat();
			const snapshots: [QueryKey, unknown][] = [];
			for (const { queryKey, update } of updates) {
				await queryClient.cancelQueries({ queryKey });
				snapshots.push(...queryClient.getQueriesData({ queryKey }));
				queryClient.setQueriesData<TData>({ queryKey }, (data) =>
					data === undefined ? data : update(data, variables),
				);
			}
			return { snapshots };
		},
		onError: (error, variables, context) => {
			for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data);
			const fallback = typeof options.failure === "function" ? options.failure(variables) : options.failure;
			if (!options.inline) toast(errorText(site, error, fallback));
			options.onError?.(error, variables);
		},
		onSuccess: (result, variables) => {
			const message = typeof options.success === "function" ? options.success(result, variables) : options.success;
			if (message) toast(message);
			options.onSuccess?.(result, variables);
		},
		// The refetch is not awaited: the mutation settles (and the caller's button re-enables) without waiting for a slow list to come back.
		onSettled: (result, _error, variables) => {
			const keys =
				typeof options.invalidate === "function" ? options.invalidate(result, variables) : (options.invalidate ?? []);
			for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
		},
	});
}
