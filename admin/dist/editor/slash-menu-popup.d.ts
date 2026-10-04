import type { SlashCommandItem } from "./slash-command.js";
interface SlashMenuPopupProps {
    items: SlashCommandItem[];
    coords: {
        top: number;
        left: number;
    };
    selectedIndex: number;
    onSelect: (item: SlashCommandItem) => void;
    onClose: () => void;
}
/**
 * `/` block insert menu. The editor handles focus and arrow keys (it does not steal focus during Korean IME composition);
 * this only draws the highlighted item (`selectedIndex`) and scrolls it into view.
 */
export declare function SlashMenuPopup({ items, coords, selectedIndex, onSelect, onClose }: SlashMenuPopupProps): import("react").ReactPortal | null;
export {};
