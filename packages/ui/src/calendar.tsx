"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { type DayButton, DayPicker, getDefaultClassNames, type Locale } from "react-day-picker";
import { cn } from "./cn";
import { ICON_BUTTON } from "./icon-button";

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	captionLayout = "label",
	locale,
	formatters,
	components,
	...props
}: React.ComponentProps<typeof DayPicker>) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn(
				"group/calendar bg-monti-page in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent p-3 [--cell-radius:var(--monti-radius-md)] [--cell-size:--spacing(8)]",
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className,
			)}
			captionLayout={captionLayout}
			locale={locale}
			formatters={{
				formatMonthDropdown: (date) => date.toLocaleString(locale?.code, { month: "short" }),
				...formatters,
			}}
			classNames={{
				root: cn("w-fit", defaultClassNames.root),
				months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
				month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
				nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaultClassNames.nav),
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
				dropdowns: cn(
					"flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-monti-body font-medium",
					defaultClassNames.dropdowns,
				),
				dropdown_root: cn("relative rounded-(--cell-radius)", defaultClassNames.dropdown_root),
				dropdown: cn("absolute inset-0 bg-monti-page opacity-0", defaultClassNames.dropdown),
				caption_label: cn(
					"font-medium select-none",
					captionLayout === "label"
						? "text-monti-body"
						: "flex items-center gap-1 rounded-(--cell-radius) text-monti-body [&>svg]:size-3.5 [&>svg]:text-monti-muted",
					defaultClassNames.caption_label,
				),
				month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
				weekdays: cn("flex", defaultClassNames.weekdays),
				weekday: cn(
					"flex-1 rounded-(--cell-radius) text-monti-caption text-monti-muted select-none",
					defaultClassNames.weekday,
				),
				week: cn("mt-2 flex w-full", defaultClassNames.week),
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
					"relative isolate z-0 rounded-l-(--cell-radius) bg-monti-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-monti-muted",
					defaultClassNames.range_start,
				),
				range_middle: cn("rounded-none", defaultClassNames.range_middle),
				range_end: cn(
					"relative isolate z-0 rounded-r-(--cell-radius) bg-monti-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-monti-muted",
					defaultClassNames.range_end,
				),
				today: cn(
					"rounded-(--cell-radius) bg-monti-muted text-monti-default data-[selected=true]:rounded-none",
					defaultClassNames.today,
				),
				outside: cn("text-monti-muted aria-selected:text-monti-muted", defaultClassNames.outside),
				disabled: cn("text-monti-muted opacity-50", defaultClassNames.disabled),
				hidden: cn("invisible", defaultClassNames.hidden),
				...classNames,
			}}
			components={{
				Root: ({ className, rootRef, ...props }) => {
					return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
				},
				Chevron: ({ className, orientation, ...props }) => {
					if (orientation === "left") {
						return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
					}

					if (orientation === "right") {
						return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
					}

					return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
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
			className={cn(
				ICON_BUTTON,
				"relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 rounded-(--cell-radius) border-0 font-normal leading-none monti-dark:hover:text-monti-default data-[range-end=true]:rounded-(--cell-radius) data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-end=true]:bg-monti-emphasis data-[range-middle=true]:bg-monti-muted data-[range-start=true]:bg-monti-emphasis data-[selected-single=true]:bg-monti-emphasis data-[range-end=true]:text-monti-on-emphasis data-[range-middle=true]:text-monti-default data-[range-start=true]:text-monti-on-emphasis data-[selected-single=true]:text-monti-on-emphasis group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-monti-contrast group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-monti-contrast/20 [&>span]:text-monti-caption [&>span]:opacity-70",
				defaultClassNames.day,
				className,
			)}
			{...props}
		/>
	);
}

export { Calendar, CalendarDayButton };
