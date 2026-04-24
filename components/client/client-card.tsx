"use client";

import * as React from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function ClientCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "rounded-[11px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-foreground/10 transition-[box-shadow,border-color] duration-200 ease-linear hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export {
  ClientCard,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
};
