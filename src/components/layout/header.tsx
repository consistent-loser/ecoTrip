import Link from 'next/link';
import { MountainSnow, Plane, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <MountainSnow className="h-6 w-6 text-primary" />
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
