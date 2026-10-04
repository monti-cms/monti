import type React from "react";
interface BlockHandleOverlayProps {
    coords: {
        top: number;
        left: number;
    };
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd?: (event: React.DragEvent<HTMLElement>) => void;
    /** Action buttons attached beside the handle (translate, etc.). */
    actions?: ReadonlyArray<{
        id: string;
        label: string;
        icon: React.ReactNode;
        busy: boolean;
        onClick: () => void;
    }>;
}
/** The ⋮⋮ handle on the left of a block and the block menu. The menu is a shadcn DropdownMenu (Base UI render prop) so it is keyboard operable too, and dragging the handle moves the block. */
export declare function BlockHandleOverlay({ coords, onMoveUp, onMoveDown, onDuplicate, onDelete, onDragStart, onDragEnd, actions, }: BlockHandleOverlayProps): React.ReactPortal | null;
export {};
