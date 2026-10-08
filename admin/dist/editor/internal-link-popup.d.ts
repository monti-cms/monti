import { type InternalLinkItem } from "./internal-link.js";
interface InternalLinkPopupProps {
    items: InternalLinkItem[];
    isLoading: boolean;
    /** Message to show in place of the result list when the search request failed. */
    error?: string | null;
    coords: {
        top: number;
        left: number;
    };
    selectedIndex: number;
    onSelect: (item: InternalLinkItem) => void;
    onClose: () => void;
}
/**
 * `[[` internal entry link search results. Same look as the slash menu.
 * The editor handles focus and arrow keys; this only draws the highlighted item (`selectedIndex`) and scrolls it into view.
 */
export declare function InternalLinkPopup({ items, isLoading, error, coords, selectedIndex, onSelect, onClose, }: InternalLinkPopupProps): import("react").ReactPortal | null;
export {};
