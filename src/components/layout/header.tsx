import Link from 'next/link';
import { Plane, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Define the AirplaneWithDollarIcon SVG component directly in this file
function AirplaneWithDollarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor" // This is for the plane outline
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Plane shape (from Lucide Plane icon) */}
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
      {/* Dollar Sign */}
      <text 
        x="12"
        y="12.5" 
        fontSize="6.5" 
        fontWeight="bold" 
        fill="currentColor" // Dollar sign filled with current text color (primary)
        stroke="none" // No stroke for the text itself, rely on fill
        textAnchor="middle" 
        dominantBaseline="middle"
      >
        $
      </text>
    </svg>
  );
}


export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <AirplaneWithDollarIcon className="h-7 w-7 text-primary" />
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
