import { useState } from "react"
import { cn } from "../../lib/utils"

export function Tabs({ defaultValue, value, onValueChange, children, className, ...props }) {
  const [activeTab, setActiveTab] = useState(defaultValue || value)
  
  const handleTabChange = (newValue) => {
    setActiveTab(newValue)
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  return (
    <div className={cn("w-full", className)} {...props}>
      {children({ activeTab, setActiveTab: handleTabChange })}
    </div>
  )
}

export function TabsList({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className, isActive, onClick, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive 
          ? "bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-gray-50" 
          : "hover:bg-white/50 hover:text-gray-950 dark:hover:bg-gray-950/50 dark:hover:text-gray-50",
        className
      )}
      onClick={() => onClick(value)}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className, isActive, ...props }) {
  if (!isActive) return null
  
  return (
    <div
      className={cn(
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}