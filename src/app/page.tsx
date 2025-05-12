
"use client";

import { useState, useEffect } from 'react';
import type { Hotel, HotelSearchCriteria, PaymentDetails } from '@/types';
import { searchHotels, simulateBookHotel, addTrip } from '@/services/booking';
import { HotelSearchForm } from '@/components/hotel-search-form';
import { HotelCard } from '@/components/hotel-card';
import { PaymentForm } from '@/components/payment-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, PartyPopper, SearchX, RefreshCcw, Leaf, PiggyBank, ServerCrash, Info } from 'lucide-react'; // Added Info for config error
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

export default function HomePage() {
  const [searchResults, setSearchResults] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showBookingSuccessDialog, setShowBookingSuccessDialog] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [lastSearchCriteria, setLastSearchCriteria] = useState<HotelSearchCriteria | null>(null);
  const [totalSavings, setTotalSavings] = useState<number>(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState<boolean>(false); // State for API key config error

  const { toast } = useToast();

  useEffect(() => {
    // Simulate fetching or calculating total savings
    // This runs client-side after hydration
    setTotalSavings(1234.56); // Mock value
  }, []);

  const handleSearch = async (criteria: HotelSearchCriteria) => {
    setIsLoading(true);
    setSearchPerformed(true);
    setSearchResults([]); // Clear previous results
    setSearchError(null); // Clear previous errors
    setIsConfigError(false); // Reset config error state
    setLastSearchCriteria(criteria);
    try {
      // Basic validation moved to searchHotels service
      const results = await searchHotels(criteria);
      setSearchResults(results);
      if (results.length === 0) {
          console.log("Search returned no results for:", criteria);
          // UI will handle empty results display
      }
    } catch (error: any) {
      console.error("Search failed:", error);
      const errorMessage = error.message || "An unknown error occurred during search.";
      setSearchError(errorMessage);

      // Check if it's the specific configuration error message from booking service
      if (errorMessage.includes("Amadeus API Key/Secret not configured") || errorMessage.includes("Invalid API Key or Secret")) {
          setIsConfigError(true);
          // No need for a toast here, the dedicated UI element will show
      } else {
         // Show toast for other types of errors (e.g., network, invalid city, date issues)
         toast({
            title: "Search Error",
            description: errorMessage,
            variant: "destructive",
         });
      }
      setSearchResults([]); // Ensure results are empty on error
    } finally {
       setIsLoading(false);
    }
  };

  const handleBookNow = (hotel: Hotel) => {
    if (!lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate) {
      toast({
        title: "Missing Dates",
        description: "Please ensure check-in and check-out dates are selected to book.",
        variant: "destructive",
      });
      // Optionally, focus the date fields or show a more prominent message
      return;
    }
     if (!lastSearchCriteria?.numberOfGuests || lastSearchCriteria.numberOfGuests < 1) {
      toast({
        title: "Missing Guests",
        description: "Please ensure the number of guests is specified.",
        variant: "destructive",
      });
       return;
    }
    setSelectedHotel(hotel);
    setShowPaymentDialog(true);
  };

  const handlePaymentSubmit = async (paymentDetails: PaymentDetails) => {
    if (!selectedHotel || !lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate || !lastSearchCriteria?.numberOfGuests) {
      toast({
        title: "Booking Error",
        description: "Missing booking information. Please start the search again.",
        variant: "destructive",
      });
      setShowPaymentDialog(false); // Close dialog if critical info is missing
      return;
    }
    setIsBooking(true);
    try {
      // Pass all required info to the booking simulation/API call
      const bookedTrip = await simulateBookHotel(
        selectedHotel,
        lastSearchCriteria.checkInDate,
        lastSearchCriteria.checkOutDate,
        lastSearchCriteria.numberOfGuests,
        paymentDetails
      );
      await addTrip(bookedTrip); // Save trip to localStorage
      setShowPaymentDialog(false);
      setShowBookingSuccessDialog(true);
      toast({
        title: "Booking Successful! (Simulated)",
        description: `${selectedHotel.name} has been booked.`,
      });
       setSelectedHotel(null); // Clear selected hotel after successful booking
       setLastSearchCriteria(prev => prev ? { ...prev, checkInDate: undefined, checkOutDate: undefined } : null); // Optionally clear dates? Or keep them?
    } catch (error) {
      console.error("Booking failed:", error);
      toast({
        title: "Booking Failed (Simulation)",
        description: "Could not complete your booking simulation. Please try again.",
        variant: "destructive",
      });
      // Keep payment dialog open for retry? Or close? Depends on UX choice.
      // setShowPaymentDialog(false);
    } finally {
        setIsBooking(false);
    }
  };

  // Recalculate total amount based on Amadeus price (which might be total)
  const calculateTotalAmount = () => {
    if (!selectedHotel) return 0;
    // Amadeus /v2/shopping/hotel-offers often returns the TOTAL price for the stay in `pricePerNight` field after transformation.
    // Let's assume pricePerNight IS the total price from the offer for now.
    return selectedHotel.pricePerNight;

    // If pricePerNight was indeed per night:
    // if (!lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate) return 0;
    // const nights = Math.ceil((lastSearchCriteria.checkOutDate.getTime() - lastSearchCriteria.checkInDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    // return nights * selectedHotel.pricePerNight * (lastSearchCriteria.numberOfGuests || 1); // Might need guest adjustment based on API price basis
  };


  return (
    <div className="container mx-auto py-8 px-4">
      <section className="text-center mb-12 hero-section py-20 bg-gradient-to-r from-primary/80 via-primary to-accent/70 rounded-lg shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
            <Image src="https://picsum.photos/seed/travelbg/1200/500" alt="Travel Background" layout="fill" objectFit="cover" data-ai-hint="landscape travel"/>
        </div>
        <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">Find Your Perfect Eco-Stay</h1>
            <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Discover sustainable hotels and unique accommodations that care for our planet. Search real inventory with Amadeus.
            </p>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4">
             {/* Ensure form is reset or defaults are appropriate */}
             <HotelSearchForm onSearch={handleSearch} isLoading={isLoading} />
        </div>
      </section>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg">Searching for eco-friendly hotels via Amadeus...</p>
        </div>
      )}

      {/* Error State */}
       {!isLoading && searchPerformed && searchError && (
         <div className="text-center py-10">
          {isConfigError ? (
             // Specific UI for Configuration Error
             <Alert variant="destructive" className="max-w-lg mx-auto bg-destructive/10 border-destructive/30">
                 <Info className="h-5 w-5 text-destructive" />
                <AlertTitle className="font-semibold text-destructive">API Configuration Error</AlertTitle>
                <AlertDescription className="text-destructive/90">
                    The hotel search feature requires API credentials that are missing or invalid. Please contact the site administrator.
                    {/* Optional: Display the technical error message for admins/devs */}
                     <details className="mt-2 text-xs">
                        <summary className="cursor-pointer hover:underline">Details</summary>
                        <p className="mt-1 text-left bg-destructive/10 p-2 rounded border border-destructive/20">{searchError}</p>
                    </details>
                </AlertDescription>
            </Alert>

          ) : (
             // Generic UI for other Search Errors
             <>
                <ServerCrash className="h-16 w-16 mx-auto text-destructive mb-4" />
                <h3 className="text-2xl font-semibold mb-2 text-destructive">Search Failed</h3>
                <p className="text-muted-foreground max-w-md mx-auto">{searchError}</p>
                {lastSearchCriteria && (
                    <Button onClick={() => handleSearch(lastSearchCriteria)} className="mt-6">
                        <RefreshCcw className="mr-2 h-4 w-4"/> Retry Search
                    </Button>
                )}
             </>
          )}
        </div>
      )}


      {/* No Results State */}
      {!isLoading && searchPerformed && !searchError && searchResults.length === 0 && (
         <div className="text-center py-10">
          <SearchX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-2xl font-semibold mb-2">No Hotels Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">We couldn't find any hotels matching your criteria via Amadeus. Try adjusting your dates, destination, or filters.</p>
        </div>
      )}

      {/* Success State - Results Found */}
      {!isLoading && !searchError && searchResults.length > 0 && (
        <section>
          <h2 className="text-3xl font-semibold mb-8 text-center">
            Available Hotels in <span className="text-primary">{lastSearchCriteria?.city}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} onBook={handleBookNow} />
            ))}
          </div>
        </section>
      )}

      {/* Initial State - Why Choose Us Section */}
      {!isLoading && !searchPerformed && !searchError && (
         <section className="py-16">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-semibold mb-6 text-primary">Why Choose ecoTrip.com?</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    We're committed to making your travel both sustainable and rewarding. Explore the unique benefits of booking with us.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
                {/* Eco Rebooking Card */}
                <div className="flex flex-col">
                    <div className="mb-6">
                        <Image src="https://picsum.photos/seed/rebook/600/400" alt="Eco Rebooking" width={600} height={400} className="w-full h-auto rounded-lg shadow-lg object-cover" data-ai-hint="savings money" />
                    </div>
                    <div className="text-center md:text-left">
                        <RefreshCcw className="h-12 w-12 text-accent mx-auto md:mx-0 mb-4" />
                        <h3 className="text-2xl font-semibold mb-3">Eco Rebooking: Save More, Effortlessly</h3>
                        <p className="text-muted-foreground leading-relaxed mb-4">
                            Book with confidence! If the price of your booked hotel drops for the same room and dates, we'll automatically rebook it for you at the lower price. Saving money on your sustainable stays has never been easier. (Feature coming soon!)
                        </p>
                        <div className="mt-6 bg-primary/10 p-6 rounded-lg shadow-md">
                            <div className="flex items-center justify-center md:justify-start text-primary mb-2">
                                <PiggyBank className="h-10 w-10 mr-3" />
                                <span className="text-3xl font-bold">
                                    {totalSavings !== null ? `$${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Loading...'}
                                </span>
                            </div>
                            <p className="text-center md:text-left text-sm text-muted-foreground font-medium">
                                Total saved by our users so far! (Simulated)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Travel Green Card */}
                <div className="flex flex-col">
                    <div className="mb-6">
                        <Image src="https://picsum.photos/seed/ecohotel/600/400" alt="Eco-Friendly Hotel Focus" width={600} height={400} className="w-full h-auto rounded-lg shadow-lg object-cover" data-ai-hint="eco hotel" />
                    </div>
                    <div className="text-center md:text-left">
                        <Leaf className="h-12 w-12 text-accent mx-auto md:mx-0 mb-4" />
                        <h3 className="text-2xl font-semibold mb-3">Travel Green: Prioritizing Low-Emission Hotels</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            We emphasize eco-friendly hotels that are actively working to reduce their carbon emissions and environmental impact. Make a positive choice for the planet by selecting accommodations that align with your sustainable values. (Based on available data)
                        </p>
                    </div>
                </div>
            </div>
             <div className="text-center mt-16">
                <p className="text-lg text-muted-foreground">
                    Ready to explore? Use the search bar above to find your next sustainable adventure.
                </p>
            </div>
        </section>
      )}


      {/* Payment Dialog */}
      {selectedHotel && (
        <Dialog open={showPaymentDialog} onOpenChange={(isOpen) => {
            setShowPaymentDialog(isOpen);
            if (!isOpen) setSelectedHotel(null); // Clear selected hotel when dialog closes
            }}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Complete Your Booking (Simulation)</DialogTitle>
              <DialogDescription>
                You're about to book <span className="font-semibold">{selectedHotel.name}</span>.
                Total Price: <span className="font-semibold">${calculateTotalAmount().toFixed(2)} {selectedHotel.currency}</span> for the stay.
                Please provide payment details for this simulation.
              </DialogDescription>
            </DialogHeader>
            <PaymentForm
              onSubmit={handlePaymentSubmit}
              isProcessing={isBooking}
              totalAmount={calculateTotalAmount()}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Booking Success Dialog */}
      <Dialog open={showBookingSuccessDialog} onOpenChange={setShowBookingSuccessDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <PartyPopper className="h-6 w-6 mr-2 text-primary" />
              Booking Successful! (Simulated)
            </DialogTitle>
            <DialogDescription>
              Your simulated eco-trip to <span className="font-semibold">{/* Find a way to show hotel name even after clear */} Trip Confirmed</span> is confirmed.
              Check your "My Trips" page for details.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" onClick={() => setShowBookingSuccessDialog(false)}>
                Great!
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
