import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md", className)}
      style={{ backgroundColor: "var(--canvas, hsl(var(--muted)))" }}
      {...props}
    />
  )
}

export { Skeleton }
