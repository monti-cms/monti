"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "./cn";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
	return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

/** What opens and closes the content. A disabled trigger is dimmed to .45 like every disabled control. Put the `Caret` after its text. */
function CollapsibleTrigger({ className, ...props }: CollapsiblePrimitive.Trigger.Props) {
	return (
		<CollapsiblePrimitive.Trigger
			data-slot="collapsible-trigger"
			className={cn("data-disabled:cursor-default data-disabled:opacity-45", className)}
			{...props}
		/>
	);
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
	return <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
