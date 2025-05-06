import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Initialize with a value that's true if window is undefined (SSR) 
  // or based on actual width. This will be corrected on client mount.
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false; // Or true, depending on desired SSR behavior. False is safer for layout shifts.
    }
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    // This effect runs only on the client after hydration
    function handleResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }

    // Set initial value correctly on client
    handleResize(); 

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}
