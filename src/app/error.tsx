"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-500 mb-6">
        Try refreshing the page or come back in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
