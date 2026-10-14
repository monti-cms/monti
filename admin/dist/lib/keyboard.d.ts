import type { KeyboardEvent } from "react";
/** Whether this key event belongs to an IME composition (Korean typing): Enter then only finishes the composition and must not submit. */
export declare const isComposingKey: (event: Pick<KeyboardEvent, "nativeEvent" | "key" | "keyCode">) => boolean;
