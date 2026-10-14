"use client";
import { useCallback, useEffect, useRef, useState } from "react";
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/**
 * The edit state every form that saves one item shares: the draft, whether it holds unsaved changes (new and existing items alike), and the
 * report of that to the parent. When `saved` changes (after a save, or the server's copy was refreshed) the draft follows it.
 */
export function useDraftEditor({ saved, empty, equals = sameJson, onDirtyChange, saving = false, deleting = false, }) {
    const baseline = saved ?? empty;
    const [draft, setDraft] = useState(baseline);
    const equalsRef = useRef(equals);
    equalsRef.current = equals;
    // The server's copy changed (a save landed, or another tab saved): the draft starts from it again.
    const baselineRef = useRef(baseline);
    useEffect(() => {
        if (equalsRef.current(baselineRef.current, baseline))
            return;
        baselineRef.current = baseline;
        setDraft(baseline);
    }, [baseline]);
    const dirty = !equals(draft, baseline);
    const notifyRef = useRef(onDirtyChange);
    notifyRef.current = onDirtyChange;
    useEffect(() => {
        notifyRef.current?.(dirty);
    }, [dirty]);
    useEffect(() => () => notifyRef.current?.(false), []);
    const update = useCallback((change) => {
        setDraft((current) => (typeof change === "function" ? change(current) : { ...current, ...change }));
    }, []);
    const reset = useCallback(() => setDraft(baselineRef.current), []);
    return {
        draft,
        update,
        replace: setDraft,
        reset,
        dirty,
        isNew: saved === null,
        saving,
        deleting,
        busy: saving || deleting,
    };
}
