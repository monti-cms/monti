import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

function Empty({ className, size = "fill", ...props }: React.ComponentProps<"div"> & { size?: "fill" | "compact" }) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance text-center",
				size === "fill" ? "min-h-64 p-12" : "p-condensed",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="empty-header" className={cn("flex max-w-sm flex-col items-center gap-2", className)} {...props} />
	);
}

const emptyMediaVariants = cva(
	"mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-monti-neutral text-monti-default [&_svg:not([class*='size-'])]:size-6",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function EmptyMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			className={cn(emptyMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="empty-title" className={cn("text-monti-title", className)} {...props} />;
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<div
			data-slot="empty-description"
			className={cn(
				"text-monti-body text-monti-muted [&>a]:text-monti-accent [&>a]:underline [&>a]:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cn("flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-monti-body", className)}
			{...props}
		/>
	);
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
