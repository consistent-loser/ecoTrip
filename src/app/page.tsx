
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
  const [isApiError, setIsApiError] = useState<boolean>(false); // State for general API/search errors
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

    // Basic client-side validation before sending to server
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

    try {
        const results = await searchHotels(criteria); // Call the Server Action

        // Check if results is actually an array (it should be)
        if (Array.isArray(results)) {
            if (results.length > 0) {
               setSearchResults(results);
               console.log(`SERVER ACTION: Found ${results.length} hotels.`);
            } else {
               console.log("SERVER ACTION: No hotel data returned (empty array).");
               // If the server action returns an empty array without throwing an error,
               // it means the search was successful but found nothing.
               // This case is handled by the UI block showing "No Hotels Found".
               setSearchResults([]);
            }
        } else {
            // This case should ideally not happen if the server action is well-defined
            console.error("SERVER ACTION Search returned unexpected non-array type:", results);
            setSearchError("Received unexpected data from the server during search.");
            setIsApiError(true); // Treat as a general API error
            setSearchResults([]);
        }


    } catch (error: any) {
        console.error("SERVER ACTION Search failed:", error);
        const errorMessage = error.message || "An unknown error occurred during search.";
        setSearchError(errorMessage); // Set the specific error message from the server

        // Distinguish between configuration errors and other API/search errors
        if (errorMessage.includes("Server configuration error:") || errorMessage.includes("API credentials missing")) {
            setIsConfigError(true);
            // Toast for immediate feedback on config issues
            toast({
                title: "Configuration Error",
                description: "The hotel search service is not configured correctly. Please contact support.",
                variant: "destructive",
            });
        } else {
            // Treat other errors as API/search related errors
            setIsApiError(true);
             toast({ // Keep toast for immediate feedback on search problems
                title: "Search Error",
                description: errorMessage, // Show the specific error from the backend
                variant: "destructive",
            });
        }
        setSearchResults([]); // Clear results on any error
    } finally {
        setIsLoading(false);
        console.log("SERVER ACTION Search finished.");
    }
  };

  const handleBookNow = (hotel: Hotel) => {
    // Ensure search criteria (dates/guests) are available from the last search
    if (!lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate || !lastSearchCriteria?.numberOfGuests) {
        toast({
            title: "Missing Booking Info",
            description: "Please ensure destination, dates, and guests are set from your last search before booking.",
            variant: "destructive",
        });
        return;
    }
    setSelectedHotel(hotel);
    setShowPaymentDialog(true);
  };

  const handlePaymentSubmit = async (paymentDetails: PaymentDetails) => {
    // Ensure selected hotel and search criteria are still valid
    if (!selectedHotel || !lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate || !lastSearchCriteria?.numberOfGuests) {
        toast({
            title: "Booking Error",
            description: "Missing booking information. Please try searching again.",
            variant: "destructive",
        });
        setShowPaymentDialog(false);
        return;
    }
    setIsBooking(true);
    const hotelToBook = selectedHotel; // Capture hotel before potentially clearing state
    setBookedHotelName(hotelToBook.name); // Set name for success dialog

    try {
        // Call the Server Action for simulated booking
        const bookedTrip = await simulateBookHotel(
            hotelToBook,
            lastSearchCriteria.checkInDate,
            lastSearchCriteria.checkOutDate,
            lastSearchCriteria.numberOfGuests,
            paymentDetails // Pass payment details for simulation logic
        );

        // Add trip to local storage (Client-side)
        await addTrip(bookedTrip);

        setShowPaymentDialog(false);
        setShowBookingSuccessDialog(true);
        toast({
            title: "Booking Successful! (Simulated)",
            description: `${hotelToBook.name} has been booked. Check 'My Trips'.`,
        });
        setSelectedHotel(null); // Clear selected hotel after successful booking

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

  // Calculates total amount based on selected hotel's price (which might be total price)
  const calculateTotalAmount = () => {
    if (!selectedHotel) return 0;
    // Assuming pricePerNight actually holds the total offer price from search results
    return selectedHotel.pricePerNight;
  };


  return (
    <div className="container mx-auto py-8 px-4">
      {/* Hero Section */}
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

      {/* Error Display Area */}
       {!isLoading && searchPerformed && searchError && (
         <div className="text-center py-10">
          {/* Configuration Error Specific Message */}
          {isConfigError ? (
             <Alert variant="destructive" className="max-w-lg mx-auto bg-destructive/10 border-destructive/30">
                 <Info className="h-5 w-5 !text-destructive" />
                <AlertTitle className="font-semibold text-destructive">Server Configuration Error</AlertTitle>
                <AlertDescription className="text-destructive/90">
                   {searchError} {/* Display the specific error from the server */}
                   <p className="mt-2 text-xs">The server is missing necessary API credentials or they are invalid. Please contact support.</p>
                </AlertDescription>
            </Alert>
          ) : /* API/Search Error Specific Message */
          isApiError ? (
             <Alert variant="destructive" className="max-w-lg mx-auto bg-destructive/10 border-destructive/30">
                 <AlertTriangle className="h-5 w-5 !text-destructive" />
                <AlertTitle className="font-semibold text-destructive">Search Problem</AlertTitle>
                <AlertDescription className="text-destructive/90">
                   {searchError} {/* Display the specific error from the server */}
                   <p className="mt-2 text-xs">There was an issue communicating with the hotel search service. Please check your search criteria or try again later.</p>
                </AlertDescription>
                 {/* Retry Button for API errors */}
                 {lastSearchCriteria && (
                    <Button onClick={() => handleSearch(lastSearchCriteria)} className="mt-6" variant="secondary">
                        <RefreshCcw className="mr-2 h-4 w-4"/> Retry Search
                    </Button>
                )}
            </Alert>
           ): /* Generic Fallback Error (should be less common now) */ (
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


      {/* No Results Found */}
      {!isLoading && searchPerformed && !searchError && searchResults.length === 0 && (
         <div className="text-center py-10">
          <SearchX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-2xl font-semibold mb-2">No Hotels Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">We couldn't find any available hotels matching your criteria via Amadeus. Try adjusting your dates, destination, or check the spelling.</p>
           {/* Allow retry even if no results found */}
           {lastSearchCriteria && (
                <Button onClick={() => handleSearch(lastSearchCriteria)} className="mt-6" variant="outline">
                    <RefreshCcw className="mr-2 h-4 w-4"/> Retry Search
                </Button>
            )}
        </div>
      )}

      {/* Search Results Display */}
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

      {/* Initial State / Why Choose Us Section */}
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
                        {/* Savings Meter */}
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
            // Clear selected hotel if dialog is closed without booking
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
