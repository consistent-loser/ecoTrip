"use client";

import { useState, useEffect } from 'react';
import type { Hotel, HotelSearchCriteria, PaymentDetails, Trip } from '@/types';
// Import server-side booking functions and client-side utilities
import { searchHotels, simulateBookHotel, addTrip, getTrips } from '@/services/booking';
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
import { Loader2, PartyPopper, SearchX, RefreshCcw, Leaf, PiggyBank, ServerCrash, Info, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

// --- Client-Side API Functions Removed ---
// getAmadeusAccessToken_Client, getCityCode_Client, and client-side search logic
// are removed. API calls are now handled by server actions in booking.ts.

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
  const [isConfigError, setIsConfigError] = useState<boolean>(false); // State for API key config error (server-side)
  // CORS error state is less relevant now, but can keep for potential server fetch issues
  const [isApiError, setIsApiError] = useState<boolean>(false);
  const [bookedHotelName, setBookedHotelName] = useState<string>(''); // To show in success dialog

  const { toast } = useToast();

  useEffect(() => {
    // Simulating fetching savings data
    const timer = setTimeout(() => {
      setTotalSavings(1234.56);
    }, 500);
    return () => clearTimeout(timer);
  }, []);


  const handleSearch = async (criteria: HotelSearchCriteria) => {
    setIsLoading(true);
    setSearchPerformed(true);
    setSearchResults([]);
    setSearchError(null);
    setIsConfigError(false);
    setIsApiError(false);
    setLastSearchCriteria(criteria);
    console.log("Initiating SERVER-SIDE Amadeus search via Server Action...");

    // --- Client-Side Validation (Remains) ---
    if (!criteria.city || !criteria.checkInDate || !criteria.checkOutDate || !criteria.numberOfGuests || criteria.numberOfGuests < 1) {
        setSearchError("Please fill in all search fields accurately.");
        setIsLoading(false);
        return;
    }
     if (criteria.checkOutDate <= criteria.checkInDate) {
        setSearchError("Check-out date must be after check-in date.");
        setIsLoading(false);
        return;
    }
    // No need to check API keys on the client anymore

    try {
        // Call the server action 'searchHotels' from booking.ts
        const results = await searchHotels(criteria);

        if (results.length > 0) {
           setSearchResults(results);
           console.log(`SERVER ACTION: Found ${results.length} hotels.`);
        } else {
           console.log("SERVER ACTION: No hotel data returned.");
           setSearchError(`No available hotels found matching your criteria in ${criteria.city} for the selected dates. Try different dates or ensure the location is correct.`);
           setSearchResults([]);
        }

    } catch (error: any) {
        console.error("SERVER ACTION Search failed:", error);
        const errorMessage = error.message || "An unknown error occurred during search.";
        setSearchError(errorMessage);

        // Check if the error message indicates a configuration issue from the server
        if (errorMessage.includes("API credentials missing")) {
            setIsConfigError(true);
            setSearchError("Server configuration error: API credentials missing. Please contact support.");
        } else if (errorMessage.includes("Amadeus auth failed") || errorMessage.includes("Search failed") || error.message.includes("No hotels found")) {
            // General API or fetch errors relayed from the server
            setIsApiError(true);
             toast({
                title: "Search Error",
                description: errorMessage, // Show the error message from the server
                variant: "destructive",
            });
        } else {
            // Other unexpected errors
             toast({
                title: "Error",
                description: "An unexpected error occurred during the search.",
                variant: "destructive",
            });
        }
        setSearchResults([]);
    } finally {
        setIsLoading(false);
        console.log("SERVER ACTION Search finished.");
    }
  };

  const handleBookNow = (hotel: Hotel) => {
    if (!lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate || !lastSearchCriteria?.numberOfGuests) {
        toast({
            title: "Missing Booking Info",
            description: "Please ensure destination, dates, and guests are set before booking.",
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
            description: "Missing booking information.",
            variant: "destructive",
        });
        setShowPaymentDialog(false);
        return;
    }
    setIsBooking(true);
    const hotelToBook = selectedHotel;
    setBookedHotelName(hotelToBook.name);

    try {
        // Call the SERVER-SIDE booking simulation via server action
        const bookedTrip = await simulateBookHotel(
            hotelToBook,
            lastSearchCriteria.checkInDate,
            lastSearchCriteria.checkOutDate,
            lastSearchCriteria.numberOfGuests,
            paymentDetails // Payment details are passed but only used for simulation logic on server
        );

        // Add trip to localStorage (Client-side action)
        await addTrip(bookedTrip);

        setShowPaymentDialog(false);
        setShowBookingSuccessDialog(true);
        toast({
            title: "Booking Successful! (Simulated)",
            description: `${hotelToBook.name} has been booked. Check 'My Trips'.`,
        });
        setSelectedHotel(null);

    } catch (error: any) {
        console.error("SERVER ACTION Booking simulation failed:", error);
        toast({
            title: "Booking Failed (Simulation)",
            description: error.message || "Could not complete your booking simulation.",
            variant: "destructive",
        });
    } finally {
        setIsBooking(false);
    }
  };

  const calculateTotalAmount = () => {
    if (!selectedHotel) return 0;
    // Assuming pricePerNight IS the total price for the stay from Amadeus Offers
    return selectedHotel.pricePerNight;
  };


  return (
    <div className="container mx-auto py-8 px-4">
        {/* Removed Client-Side Security Warning Banner */}

      <section className="text-center mb-12 hero-section py-16 md:py-20 bg-gradient-to-r from-primary/80 via-primary to-accent/70 rounded-lg shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
            <Image src="https://picsum.photos/seed/travelbg/1200/500" alt="Scenic travel background" layout="fill" objectFit="cover" data-ai-hint="landscape travel" priority />
        </div>
        <div className="relative z-10 px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4 drop-shadow-md">Find Your Perfect Eco-Stay</h1>
            <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-3xl mx-auto drop-shadow-sm">
            Discover sustainable hotels worldwide using real-time Amadeus data. Book responsibly, travel consciously.
            </p>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4">
             <HotelSearchForm onSearch={handleSearch} isLoading={isLoading} />
        </div>
      </section>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col justify-center items-center py-10 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-foreground">Searching for eco-friendly hotels via Amadeus (Server-Side)...</p>
          <p className="text-sm text-muted-foreground">This may take a moment.</p>
        </div>
      )}

      {/* Error State */}
       {!isLoading && searchPerformed && searchError && (
         <div className="text-center py-10">
          {isConfigError ? ( // Specific error for missing server credentials
             <Alert variant="destructive" className="max-w-lg mx-auto bg-destructive/10 border-destructive/30">
                 <Info className="h-5 w-5 !text-destructive" />
                <AlertTitle className="font-semibold text-destructive">Server Configuration Error</AlertTitle>
                <AlertDescription className="text-destructive/90">
                   {searchError}
                   <p className="mt-2 text-xs">The server is missing necessary API credentials to connect to the hotel service. Please contact support.</p>
                </AlertDescription>
            </Alert>
          ) : isApiError ? ( // General API errors from the server
             <Alert variant="destructive" className="max-w-lg mx-auto bg-destructive/10 border-destructive/30">
                 <AlertTriangle className="h-5 w-5 !text-destructive" />
                <AlertTitle className="font-semibold text-destructive">Search API Error</AlertTitle>
                <AlertDescription className="text-destructive/90">
                   {searchError}
                    <p className="mt-2 text-xs">There was an issue communicating with the hotel search service. Please check your search criteria or try again later.</p>
                </AlertDescription>
            </Alert>
           ): ( // Other unexpected errors
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
          <p className="text-muted-foreground max-w-md mx-auto">We couldn't find any available hotels matching your criteria via Amadeus. Try adjusting your dates, destination, or check the spelling.</p>
           {lastSearchCriteria && (
                <Button onClick={() => handleSearch(lastSearchCriteria)} className="mt-6" variant="outline">
                    <RefreshCcw className="mr-2 h-4 w-4"/> Retry Search
                </Button>
            )}
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
                <div className="flex flex-col items-center md:items-start">
                    <div className="mb-6 w-full max-w-md">
                        <Image src="https://picsum.photos/seed/rebook/600/400" alt="Piggy bank symbolizing savings" width={600} height={400} className="w-full h-auto rounded-lg shadow-lg object-cover" data-ai-hint="savings money" />
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
                                Total potentially saved by our users so far! (Simulated)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Travel Green Card */}
                <div className="flex flex-col items-center md:items-start">
                    <div className="mb-6 w-full max-w-md">
                        <Image src="https://picsum.photos/seed/ecohotel/600/400" alt="Hotel building with green leaves overlay" width={600} height={400} className="w-full h-auto rounded-lg shadow-lg object-cover" data-ai-hint="eco hotel" />
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
            if (!isOpen) setSelectedHotel(null);
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
              Your simulated eco-trip to <span className="font-semibold">{bookedHotelName}</span> is confirmed.
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
