"use client"

import { cn } from "@/lib/utils"
import React from "react"

export interface LoaderProps {
  variant?:
    | "circular"
    | "classic"
    | "pulse"
    | "pulse-dot"
    | "dots"
    | "typing"
    | "wave"
    | "bars"
    | "terminal"
    | "text-blink"
    | "text-shimmer"
    | "loading-dots"
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
}

export function TerminalLoader({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const cursorSizes = {
    sm: "h-3 w-1.5",
    md: "h-4 w-2",
    lg: "h-5 w-2.5",
  }

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  const containerSizes = {
    sm: "h-4",
    md: "h-5",
    lg: "h-6",
  }

  return (
    <div
      className={cn(
        "flex items-center space-x-1",
        containerSizes[size],
        className
      )}
    >
      <span className={cn("font-mono", textSizes[size])} style={{ color: '#00ff00' }}>
        {">"}
      </span>
      <div
        className={cn(
          "animate-[blink-cursor_1s_step-end_infinite]",
          cursorSizes[size]
        )}
        style={{ backgroundColor: '#00ff00' }}
      />
      <span className="sr-only">Loading</span>
    </div>
  )
}

function Loader({
  variant = "terminal",
  size = "md",
  text,
  className,
}: LoaderProps) {
  if (variant === "terminal") {
    return <TerminalLoader size={size} className={className} />
  }
  
  return <TerminalLoader size={size} className={className} />
}

export { Loader }
