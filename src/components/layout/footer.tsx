export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          &copy; {currentYear} ecoTrip.com. All rights reserved.
        </p>
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-right">
          Travel responsibly. Explore sustainably.
        </p>
      </div>
    </footer>
  );
}
