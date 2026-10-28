"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { ChevronDown, ChevronLeft, ChevronRight } from "@carbon/icons-react";
import * as React from "react";
import { type DayButton, DayPicker, getDefaultClassNames, type Locale } from "react-day-picker";
import { cn } from "./cn";
import { ICON_BUTTON } from "./icon-button";

/**
 * A month grid of 32px cells for picking a day or a range (the date filter's "pick a period"), as the design system draws it: weekdays in mono 11 subtle,
 * days in ink, the days of the neighboring months in `fg-faint`, today in a thin line, the picked day a black cell and the days between a `bg-selected` band.
 */
function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	locale,
	components,
	...props
}: React.ComponentProps<typeof DayPicker>) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn(
				"group/calendar bg-monti-page in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent p-monti-12 [--cell-radius:var(--monti-radius-md)] [--cell-size:--spacing(8)]",
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className,
			)}
			captionLayout="label"
			locale={locale}
			classNames={{
				root: cn("w-fit", defaultClassNames.root),
				months: cn("relative flex flex-col gap-monti-16 md:flex-row", defaultClassNames.months),
				month: cn("flex w-full flex-col gap-monti-16", defaultClassNames.month),
				nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-monti-4", defaultClassNames.nav),
				button_previous: cn(
					ICON_BUTTON,
					"size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
					defaultClassNames.button_previous,
				),
				button_next: cn(
					ICON_BUTTON,
					"size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
					defaultClassNames.button_next,
				),
				month_caption: cn(
					"flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
					defaultClassNames.month_caption,
				),
				caption_label: cn("text-monti-body font-semibold select-none", defaultClassNames.caption_label),
				month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
				weekdays: cn("flex", defaultClassNames.weekdays),
				weekday: cn(
					"flex h-6 flex-1 items-center justify-center rounded-(--cell-radius) text-monti-micro text-monti-subtle select-none",
					defaultClassNames.weekday,
				),
				week: cn("mt-monti-2 flex w-full", defaultClassNames.week),
				week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
				week_number: cn("text-monti-caption text-monti-muted select-none", defaultClassNames.week_number),
				day: cn(
					"group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
					props.showWeekNumber
						? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
						: "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
					defaultClassNames.day,
				),
				range_start: cn(
					"relative isolate z-0 rounded-l-(--cell-radius) bg-monti-selected after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-monti-selected",
					defaultClassNames.range_start,
				),
				range_middle: cn("rounded-none", defaultClassNames.range_middle),
				range_end: cn(
					"relative isolate z-0 rounded-r-(--cell-radius) bg-monti-selected after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-monti-selected",
					defaultClassNames.range_end,
				),
				today: cn(
					"rounded-(--cell-radius) shadow-[inset_0_0_0_1px_var(--monti-border-strong)] data-[selected=true]:rounded-none data-[selected=true]:shadow-none",
					defaultClassNames.today,
				),
				outside: cn(defaultClassNames.outside),
				disabled: cn("opacity-45", defaultClassNames.disabled),
				hidden: cn("invisible", defaultClassNames.hidden),
				...classNames,
			}}
			components={{
				Root: ({ className, rootRef, ...props }) => {
					return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
				},
				Chevron: ({ className, orientation, ...props }) => {
					if (orientation === "left") {
						return <ChevronLeft className={cn("size-4", className)} {...props} />;
					}

					if (orientation === "right") {
						return <ChevronRight className={cn("size-4", className)} {...props} />;
					}

					return <ChevronDown className={cn("size-4", className)} {...props} />;
				},
				DayButton: ({ ...props }) => <CalendarDayButton locale={locale} {...props} />,
				WeekNumber: ({ children, ...props }) => {
					return (
						<td {...props}>
							<div className="flex size-(--cell-size) items-center justify-center text-center">{children}</div>
						</td>
					);
				},
				...components,
			}}
			{...props}
		/>
	);
}

function CalendarDayButton({
	className,
	day,
	modifiers,
	locale,
	...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
	const defaultClassNames = getDefaultClassNames();

	const ref = React.useRef<HTMLButtonElement>(null);
	React.useEffect(() => {
		if (modifiers.focused) ref.current?.focus();
	}, [modifiers.focused]);

	return (
		<ButtonPrimitive
			ref={ref}
			data-day={day.date.toLocaleDateString(locale?.code)}
			data-selected-single={
				modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
			}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			data-outside={modifiers.outside || undefined}
			className={cn(
				ICON_BUTTON,
				"relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-monti-4 rounded-(--cell-radius) border-0 text-monti-default text-monti-note leading-none monti-dark:hover:text-monti-default data-[range-end=true]:rounded-(--cell-radius) data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-end=true]:bg-monti-emphasis data-[range-middle=true]:bg-monti-selected data-[range-start=true]:bg-monti-emphasis data-[selected-single=true]:bg-monti-emphasis data-[range-end=true]:text-monti-on-emphasis data-[range-middle=true]:text-monti-default data-[range-start=true]:text-monti-on-emphasis data-[selected-single=true]:text-monti-on-emphasis group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-monti-contrast group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-monti-contrast/20 [&>span]:text-monti-caption [&>span]:opacity-70",
				// The days of the neighboring months, but not one that is picked (it is a black cell and reads on its own).
				"data-[range-end=true]:data-outside:text-monti-on-emphasis data-[range-middle=true]:data-outside:text-monti-faint data-[range-start=true]:data-outside:text-monti-on-emphasis data-[selected-single=true]:data-outside:text-monti-on-emphasis data-outside:text-monti-faint",
				defaultClassNames.day,
				className,
			)}
			{...props}
		/>
	);
}

export { Calendar, CalendarDayButton };
