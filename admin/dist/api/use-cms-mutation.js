import { useSite } from "@monti-cms/core/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorText } from "./client.js";
/**
 * A write to the server that owns the whole after-math: the optimistic change and its rollback, the success and failure toasts, and
 * the invalidation. A screen calls `mutate` / `mutateAsync` and keeps only what is its own (closing a dialog, moving the selection).
 */
export function useCmsMutation(options) {
    const site = useSite();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables) => options.fn(variables, { site }),
        onMutate: async (variables) => {
            const updates = options.optimistic === undefined ? [] : [options.optimistic].flat();
            const snapshots = [];
            for (const { queryKey, update } of updates) {
                await queryClient.cancelQueries({ queryKey });
                snapshots.push(...queryClient.getQueriesData({ queryKey }));
                queryClient.setQueriesData({ queryKey }, (data) => data === undefined ? data : update(data, variables));
            }
            return { snapshots };
        },
        onError: (error, variables, context) => {
            for (const [key, data] of context?.snapshots ?? [])
                queryClient.setQueryData(key, data);
            const fallback = typeof options.failure === "function" ? options.failure(variables) : options.failure;
            if (!options.inline)
                toast.error(errorText(site, error, fallback));
            options.onError?.(error, variables);
        },
        onSuccess: (result, variables) => {
            const message = typeof options.success === "function" ? options.success(result, variables) : options.success;
            if (message)
                toast.success(message);
            options.onSuccess?.(result, variables);
        },
        // The refetch is not awaited: the mutation settles (and the caller's button re-enables) without waiting for a slow list to come back.
        onSettled: (result, _error, variables) => {
            const keys = typeof options.invalidate === "function" ? options.invalidate(result, variables) : (options.invalidate ?? []);
            for (const queryKey of keys)
                void queryClient.invalidateQueries({ queryKey });
        },
    });
}
