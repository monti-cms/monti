"use client";

import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "./cn";
import { SidePanel } from "./side-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

/**
 * The properties pane of the editor: a tab bar at the top (no head and no close button), then the list of properties: each is a `FormField` whose input is there from the start, and that input's underline is the row's only line. It is a `SidePanel` 300px wide whose
 * pinned row is the tab bar. `children` is the list of the picked tab.
 */
function PropertyPanel({
	title,
	label,
	value,
	onValueChange,
	tabs,
	onClose,
	children,
}: {
	/** A head above the tab bar, for a pane that is not the editor's own (the preview in the settings). */
	title?: ReactNode;
	/** The head's ×, for a pane with a head that can be closed. */
	onClose?: () => void;
	/** The pane's name. */
	label: string;
	/** The picked tab. */
	value: string;
	onValueChange: (value: string) => void;
	/** The tabs; `dot` marks a tab with something to handle. */
	tabs: readonly { value: string; label: string; dot?: "warning" | "proposal"; dotLabel?: string }[];
	children?: ReactNode;
}) {
	return (
		<Tabs
			// As wide as the panel inside: it is the panel that is dragged wider, so a fixed width here would push it off the right edge.
			className="h-full w-full shrink-0 gap-0 sm:w-auto"
			value={value}
			onValueChange={(next) => onValueChange(String(next))}
		>
			<SidePanel
				width="panel"
				bleed
				title={title}
				aria-label={label}
				onClose={onClose}
				className="min-h-0 flex-1"
				bar={
					<TabsList variant="bar" aria-label={label}>
						{tabs.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value} dot={tab.dot} dotLabel={tab.dotLabel}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				}
			>
				{/* The pane spaces its groups: 20px under the tab bar, 24px between groups. */}
				<TabsContent value={value} className="flex flex-col gap-monti-24 px-monti-24 pt-monti-20 pb-monti-32">
					{children}
				</TabsContent>
			</SidePanel>
		</Tabs>
	);
}

/**
 * A run of rows, with an optional quiet subheading above it ("Classification", 12px over the first row), 20px between rows. No rule of its own: each input
 * draws its line. It keeps no room around itself: the {@link PropertyPanel} puts 24px between groups.
 */
function PropertyGroup({
	title,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & { title?: ReactNode }) {
	const titleId = useId();
	return (
		<section
			data-slot="property-group"
			aria-labelledby={title ? titleId : undefined}
			className={cn("flex flex-col gap-monti-12", className)}
			{...props}
		>
			{title && (
				<h3 id={titleId} className="m-0 font-normal text-monti-micro text-monti-muted">
					{title}
				</h3>
			)}
			<div className="flex flex-col gap-monti-20">{children}</div>
		</section>
	);
}

export { PropertyGroup, PropertyPanel };
