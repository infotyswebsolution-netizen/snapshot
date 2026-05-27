"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Camera, Package, Truck, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

const BOTTOM_NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/scan", icon: Camera, label: "Scan" },
  { href: "/inventory", icon: Package, label: "Inventory" },
  { href: "/suppliers", icon: Truck, label: "Suppliers" },
];

export function MobileNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Top bar on mobile */}
      <header className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-gray-100 bg-white sticky top-0 z-50">
        <span className="font-bold text-lg tracking-tight">SnapStock</span>
        <Sheet>
          <SheetTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-gray-100 transition-colors">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-60">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation menu</SheetTitle>
            </SheetHeader>
            <Sidebar businessName={businessName} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Bottom tab bar on mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-50 safe-area-pb">
        <div className="flex">
          {BOTTOM_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] text-xs font-medium transition-colors",
                  active
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 mb-0.5",
                    active ? "text-blue-600" : "text-gray-400"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
