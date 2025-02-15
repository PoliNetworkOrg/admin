import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLElement> & {
  block?: boolean;
};

export function Code({ block, children, className }: Props) {
  if (block) {
    return (
      <pre className={cn("bg-gray-200 text-gray-800 font-mono text-sm rounded-lg p-4 border border-gray-300 overflow-x-auto dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700", className)}>
        <code>{children}</code>
      </pre>
    );
  }

  return (
    <code className={cn("bg-gray-200 text-gray-800 font-mono text-xs rounded-lg leading-5 px-2 py-1 border border-gray-300 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700", className)}>
      {children}
    </code>
  );
}
