import Link from 'next/link';
import { Plane, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Define the OwlWithCashIcon SVG component directly in this file
function OwlWithCashIcon(props: React.SVGProps<SVGSVGElement>) {
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
      {/* Simplified Owl Body */}
      <path d="M15 14c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-3.52 2.55-6.43 5.88-6.92" />
      <path d="M15 14c0-3.87 3.13-7 7-7s7 3.13 7 7c0 3.52-2.55 6.43-5.88 6.92" />
      {/* Owl Head */}
      <path d="M12 12a3 3 0 0 0 3-3c0-1.41-.93-2.58-2.18-2.89" />
      <path d="M12 12a3 3 0 0 1-3-3c0-1.41.93-2.58 2.18-2.89" />
      <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1z" /> {/* Tuft */}
      {/* Eyes */}
      <circle cx="10" cy="9" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="9" r="1.5" fill="currentColor"/>
      {/* Beak */}
      <path d="m12 10 1 1-1 1-1-1z" />
      
      {/* Cash Symbol (simplified) - Dollar signs in hands/wings */}
      {/* Left Hand/Wing with $ */}
      <path d="M8 17c-1 0-1.5-.5-1.5-1.5S7 14 8 14" />
      <text x="6" y="15.5" fontSize="3" fontWeight="bold" fill="currentColor" >$</text>
      
      {/* Right Hand/Wing with $ */}
      <path d="M16 17c1 0 1.5-.5 1.5-1.5S17 14 16 14" />
      <text x="17" y="15.5" fontSize="3" fontWeight="bold" fill="currentColor" >$</text>
    </svg>
  );
}


export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <OwlWithCashIcon className="h-7 w-7 text-primary" />
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