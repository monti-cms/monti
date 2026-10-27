/**
 * The two sizes every text control shares (Input, Textarea, Select, Combobox), so a compact control in a toolbar or a table matches the 28px
 * buttons beside it and a form control matches the 32px ones. On a phone the default size writes 16px so the browser does not zoom in.
 */
export const CONTROL_SIZE = {
	sm: "h-monti-control-sm text-monti-label md:text-monti-label",
	default: "h-monti-icon text-monti-reading md:text-monti-label",
} as const;

export type ControlSize = keyof typeof CONTROL_SIZE;
