import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";

const spinnerVariants = cva("animate-spin", {
	variants: { size: { sm: "size-3", md: "size-4", lg: "size-6" } },
	defaultVariants: { size: "md" },
});

function Spinner({ className, size, ...props }: React.ComponentProps<"svg"> & VariantProps<typeof spinnerVariants>) {
	const labels = useUiLabels();
	return (
		<Loader2Icon
			data-slot="spinner"
			role="status"
			aria-label={labels.loading}
			className={cn(spinnerVariants({ size }), className)}
			{...props}
		/>
	);
}

export { Spinner };
