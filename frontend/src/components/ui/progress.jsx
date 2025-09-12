import { cn } from "../../lib/utils"

export function Progress({ value = 0, max = 100, className, ...props }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  return (
    <div
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800",
        className
      )}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-blue-600 transition-all duration-300 ease-in-out dark:bg-blue-400"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  )
}