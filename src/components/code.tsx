import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLElement> & {
  block?: boolean;
};

export function Code({ block, children, className }: Props) {
  if (block) {
    return (
      <pre
        className={cn(
          "overflow-x-auto rounded-lg border border-gray-300 bg-gray-200 p-4 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
          className,
        )}
      >
        <code>{children}</code>
      </pre>
    );
  }

  return (
    <code
      className={cn(
        "rounded-lg border border-gray-300 bg-gray-200 px-2 py-1 font-mono text-xs leading-5 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
        className,
      )}
    >
      {children}
    </code>
  );
}
