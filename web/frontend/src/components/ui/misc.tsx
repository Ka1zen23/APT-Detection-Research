import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded bg-elevated", className)} {...props} />;
}

function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-elevated", className)}>
      <div
        className={cn("h-full bg-primary transition-transform", indicatorClassName)}
        style={{
          transform: `scaleX(${Math.max(0, Math.min(100, value)) / 100})`,
          transformOrigin: "left center",
        }}
      />
    </div>
  );
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Skeleton,
  Progress,
};
