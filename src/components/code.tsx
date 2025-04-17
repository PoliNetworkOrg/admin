"use client";
import { cn } from "@/lib/utils";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

type Props = React.HTMLAttributes<HTMLElement> & {
  block?: boolean;
  copyOnClick?: boolean;
};

export function Code({ block, copyOnClick, children, className }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  const copy = useCallback(async () => {
    try {
      if (!ref.current) return;
      await navigator.clipboard.writeText(ref.current.innerText);
      toast("Copied successfully");
    } catch (e) {
      console.error("cannot copy", e);
    }
  }, [ref]);

  if (block) {
    return (
      <pre
        className={cn(
          "overflow-x-auto rounded-lg border border-gray-300 bg-gray-200 p-4 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
          copyOnClick ? "cursor-pointer" : "",
          className,
        )}
        onClick={copyOnClick ? copy : undefined}
      >
        <code ref={ref}>{children}</code>
      </pre>
    );
  }

  return (
    <code
      className={cn(
        "rounded-lg border border-gray-300 bg-gray-200 px-2 py-1 font-mono text-xs leading-5 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
        copyOnClick ? "cursor-pointer" : "",
        className,
      )}
      onClick={copyOnClick ? copy : undefined}
      ref={ref}
    >
      {children}
    </code>
  );
}
