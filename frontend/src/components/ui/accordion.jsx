import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

export function Accordion({ children, type = "single", collapsible = false, className, ...props }) {
  return (
    <div className={cn("w-full", className)} {...props}>
      {children}
    </div>
  )
}

export function AccordionItem({ value, children, className, ...props }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className={cn("border-b", className)} {...props}>
      {children({ isOpen, setIsOpen })}
    </div>
  )
}

export function AccordionTrigger({ children, className, isOpen, onClick, ...props }) {
  return (
    <button
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
    </button>
  )
}

export function AccordionContent({ children, className, isOpen, ...props }) {
  return (
    <div
      className={cn(
        "overflow-hidden text-sm transition-all",
        isOpen ? "animate-accordion-down" : "animate-accordion-up"
      )}
      style={{
        display: isOpen ? "block" : "none"
      }}
      {...props}
    >
      <div className={cn("pb-4 pt-0", className)}>
        {children}
      </div>
    </div>
  )
}