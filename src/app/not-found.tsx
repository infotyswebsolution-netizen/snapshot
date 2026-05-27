import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-6">That page doesn&apos;t exist.</p>
      <Link href="/dashboard" className={buttonVariants()}>Go to dashboard</Link>
    </div>
  );
}
