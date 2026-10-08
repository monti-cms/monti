import type { ReactNode } from "react";
import type { SlotRequest } from "./registry.js";
export { CORE_SLOT_NAMES, type CoreSlotName, type SlotAction, type SlotApplyMode, type SlotCandidate, type SlotContext, type SlotName, SlotRegistryProvider, type SlotRequest, type SlotResult, type SlotSource, } from "./registry.js";
/** Shape of one result candidate. The AI screen's test results use the same shape. */
export declare const SLOT_CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border bg-cms-background px-2 py-0.5";
/**
 * The button (`trigger`) and result panel (`panel`) of one slot. The button goes next to the label and the result below the input.
 * Both are `null` when no action is attached.
 */
export declare function useSlot(request: SlotRequest): {
    trigger: ReactNode;
    panel: ReactNode;
};
/** Wrapper for using slots inside loops and conditions. Run state is kept per `request.scope`. */
export declare function SlotScope({ request, children, }: {
    request: SlotRequest;
    children: (slot: {
        trigger: ReactNode;
        panel: ReactNode;
    }) => ReactNode;
}): import("react").JSX.Element;
