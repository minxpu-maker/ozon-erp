import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
