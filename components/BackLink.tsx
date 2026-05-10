"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type MouseEvent } from "react";

export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const onClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (typeof window !== "undefined" && window.history.length > 1) {
        e.preventDefault();
        router.back();
      }
    },
    [router],
  );
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
