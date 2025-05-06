import Link from "next/link";

import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";
import { Plane } from "lucide-react";

function OwlIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 11 9-7 9 7" />
      <path d="m5.45 19 2.03-3.48M18.55 19 16.52 15.52" />
      <path d="M12 4v16" />
      <circle cx="12" cy="11" r="1" />
      <circle cx="7" cy="16" r="1" />
      <circle cx="17" cy="16" r="1" />
      none"/>
    </svg>
  );
}


export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <OwlIcon className="h-7 w-7 text-primary" />
          <span className="font-bold sm:inline-block text-lg">
            ecoTrip.com
          </span>
        </Link>
        <nav className="flex flex-1 items-center space-x-4 lg:space-x-6">
          <Link
            href="/trips"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <Plane className="inline-block h-4 w-4 mr-1 mb-0.5" />
            My Trips
          </Link>
        </nav>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/signin">
              <UserCircle className="h-5 w-5 mr-1" />
              Sign In
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}


