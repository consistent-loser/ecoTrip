import Link from 'next/link';
import { MountainSnow } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 p-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center space-x-2">
          <MountainSnow className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">
            ecoTrip.com
          </span>
        </Link>
      </div>
      {children}
    </div>
  );
}
