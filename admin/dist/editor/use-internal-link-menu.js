/**
 * State of the `[[` internal link menu: when it opens, the debounced search of link targets, selection by keyboard,
 * and inserting the chosen target.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { errorText } from "../api/client.js";
import { useDebounced } from "../screens/shared/use-debounced.js";
import { insertInternalLink, parseInternalLinkTrigger } from "./internal-link.js";
import { linkSearchKey, searchLinkTargets } from "./internal-link-search.js";
export function useInternalLinkMenu({ site, t, editorRef, }) {
    const [link, setLink] = useState(null);
    // The `[[` search follows the typed text after a pause. The items already shown stay while the next ones load.
    const linkQuery = link?.query;
    const debouncedLinkQuery = useDebounced(linkQuery ?? "", 200);
    const linkSearch = useQuery({
        queryKey: linkSearchKey(debouncedLinkQuery),
        queryFn: () => searchLinkTargets(site, debouncedLinkQuery),
        enabled: linkQuery !== undefined,
        placeholderData: keepPreviousData,
        retry: false,
    });
    const linkItems = linkSearch.data ?? [];
    const isLinkLoading = linkQuery !== undefined && (linkSearch.isFetching || linkQuery !== debouncedLinkQuery);
    const linkError = linkQuery !== undefined && !isLinkLoading && linkSearch.isError
        ? errorText(site, linkSearch.error, t("internalLink.error"))
        : null;
    const linkRangeRef = useRef(null);
    const linkRef = useRef(link);
    linkRef.current = link;
    const linkItemsRef = useRef(linkItems);
    linkItemsRef.current = linkItems;
    /** Opens the menu when the text before the cursor is an unfinished `[[` trigger; closes it otherwise. Returns whether it is open. */
    const syncLink = (current, textBefore, from) => {
        const linkMatch = parseInternalLinkTrigger(textBefore);
        if (linkMatch.active) {
            linkRangeRef.current = { from: from - linkMatch.query.length - 2, to: from };
            setLink({ query: linkMatch.query, index: 0, coords: current.view.coordsAtPos(from) });
            return true;
        }
        setLink(null);
        return false;
    };
    const chooseLink = (item) => {
        const current = editorRef.current;
        if (!current || !linkRangeRef.current)
            return;
        insertInternalLink(site, current, linkRangeRef.current, item);
        setLink(null);
    };
    /** Keyboard handling while the menu is open. Returns the handled result, or `undefined` when the key is not for the menu. */
    const handleKey = (event) => {
        const openLink = linkRef.current;
        if (!openLink)
            return undefined;
        const items = linkItemsRef.current;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setLink({ ...openLink, index: items.length ? (openLink.index + step + items.length) % items.length : 0 });
            return true;
        }
        if (event.key === "Enter") {
            const selected = items[openLink.index];
            if (!selected) {
                setLink(null);
                return false;
            }
            event.preventDefault();
            chooseLink(selected);
            return true;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            setLink(null);
            return true;
        }
        return undefined;
    };
    return {
        link,
        linkItems,
        isLinkLoading,
        linkError,
        closeLink: () => setLink(null),
        syncLink,
        chooseLink,
        handleKey,
    };
}
