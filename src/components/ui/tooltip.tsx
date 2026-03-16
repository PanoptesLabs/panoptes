"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider(props: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider {...props} />
}

function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />
}

function TooltipTrigger({
  className,
  ...props
}: TooltipPrimitive.Trigger.Props) {
  return (
    <TooltipPrimitive.Trigger
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-soft-violet/50 rounded", className)}
      {...props}
    />
  )
}

function TooltipPortal(props: TooltipPrimitive.Portal.Props) {
  return <TooltipPrimitive.Portal {...props} />
}

function TooltipPositioner({
  className,
  ...props
}: TooltipPrimitive.Positioner.Props) {
  return (
    <TooltipPrimitive.Positioner
      className={cn("z-50", className)}
      {...props}
    />
  )
}

function TooltipPopup({
  className,
  ...props
}: TooltipPrimitive.Popup.Props) {
  return (
    <TooltipPrimitive.Popup
      className={cn(
        "max-w-xs rounded-lg border border-deep-iris bg-midnight-plum px-3 py-2 text-xs text-dusty-lavender/70 shadow-lg",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className,
      )}
      {...props}
    />
  )
}

function TooltipArrow({
  className,
  ...props
}: TooltipPrimitive.Arrow.Props) {
  return (
    <TooltipPrimitive.Arrow
      className={cn("fill-midnight-plum stroke-deep-iris", className)}
      {...props}
    />
  )
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
  TooltipArrow,
}
