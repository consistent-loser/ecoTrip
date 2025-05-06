import Link from 'next/link';

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

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 p-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center space-x-2">
          <AirplaneWithDollarIcon className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">
            ecoTrip.com
          </span>
        </Link>
      </div>
      {children}
    </div>
  );
}
