import { useState, useEffect } from "react"
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react"
import { cn } from "../../lib/utils"

const toastVariants = {
  default: "bg-white border-gray-200 text-gray-900",
  destructive: "bg-red-50 border-red-200 text-red-900",
  success: "bg-green-50 border-green-200 text-green-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  info: "bg-blue-50 border-blue-200 text-blue-900"
}

const toastIcons = {
  default: Info,
  destructive: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info
}

export function Toast({ 
  title, 
  description, 
  variant = "default", 
  duration = 5000, 
  onClose,
  className,
  ...props 
}) {
  const [isVisible, setIsVisible] = useState(true)
  const Icon = toastIcons[variant]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onClose?.(), 300)
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 w-full max-w-sm rounded-lg border p-4 shadow-lg transition-all duration-300",
        toastVariants[variant],
        isVisible ? "animate-in slide-in-from-top-2" : "animate-out slide-out-to-top-2",
        className
      )}
      {...props}
    >
      <div className="flex items-start space-x-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {title && (
            <div className="font-medium text-sm">{title}</div>
          )}
          {description && (
            <div className="text-sm opacity-90 mt-1">{description}</div>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(() => onClose?.(), 300)
          }}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Toast context and hook for managing toasts
let toastId = 0
const toasts = new Map()
const listeners = new Set()

function notifyListeners() {
  listeners.forEach(listener => listener(Array.from(toasts.values())))
}

export function toast({ title, description, variant = "default", duration = 5000 }) {
  const id = ++toastId
  const toastData = { id, title, description, variant, duration }
  
  toasts.set(id, toastData)
  notifyListeners()
  
  if (duration > 0) {
    setTimeout(() => {
      toasts.delete(id)
      notifyListeners()
    }, duration + 300) // Add 300ms for exit animation
  }
  
  return id
}

export function useToasts() {
  const [toastList, setToastList] = useState([])
  
  useEffect(() => {
    const listener = (newToasts) => setToastList(newToasts)
    listeners.add(listener)
    
    return () => listeners.delete(listener)
  }, [])
  
  const removeToast = (id) => {
    toasts.delete(id)
    notifyListeners()
  }
  
  return { toasts: toastList, removeToast }
}

export function ToastProvider({ children }) {
  const { toasts: toastList, removeToast } = useToasts()
  
  return (
    <>
      {children}
      <div className="fixed top-0 right-0 z-50 p-4 space-y-2">
        {toastList.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            duration={0} // Managed by the toast system
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </>
  )
}