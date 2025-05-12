
"use client";

import { useState, useEffect } from 'react';
import type { Hotel, HotelSearchCriteria, PaymentDetails, Trip, AmadeusAccessToken, AmadeusHotelOffer } from '@/types';
// Import CLIENT-SIDE utilities from booking service
import { transformAmadeusHotelOffer, addTrip, getTrips, CLIENT_AMADEUS_CONFIG, simulateBookHotel_Client } from '@/services/booking';
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
import { Loader2, PartyPopper, SearchX, RefreshCcw, Leaf, PiggyBank, ServerCrash, Info, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

// --- Client-Side Amadeus API Functions ---
// WARNING: Including secrets directly in client-side code is INSECURE.
// These functions replicate the server-side logic but run in the browser.
// CORS errors are likely when calling APIs directly from the browser this way.

async function getAmadeusAccessToken_Client(): Promise<string> {
    const { apiKey, apiSecret, baseUrl } = CLIENT_AMADEUS_CONFIG;
    const url = `${baseUrl}/v1/security/oauth2/token`;

    if (!apiKey || !apiSecret) {
        // This error should ideally be caught before calling, but double-check
        throw new Error("CLIENT_ERROR: Amadeus API Key/Secret missing in config. Cannot authenticate.");
    }

    try {
        console.log("CLIENT: Attempting to fetch Amadeus token from:", url);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
            // Client-side fetch doesn't need cache: 'no-store' in the same way server does
            // 'mode: "no-cors"' might hide the error but won't make the request succeed if CORS is enforced server-side.
            // mode: 'no-cors', // Avoid using no-cors unless you understand the implications. It often masks the real issue.
        });
        console.log("CLIENT: Amadeus token response status:", response.status);


        if (!response.ok) {
            const errorBody = await response.text();
            console.error("CLIENT Amadeus Auth Error Response Body:", errorBody);
            let errorMessage = `CLIENT Amadeus auth failed: ${response.status} ${response.statusText}`;
            try {
                const errorJson = JSON.parse(errorBody);
                 if (errorJson.error === 'invalid_client') {
                    errorMessage = `CLIENT Amadeus auth failed: Invalid API Key or Secret provided. Check configuration. (Code: ${errorJson.code || 'N/A'})`;
                 } else if (errorJson.title) {
                     errorMessage = `CLIENT Amadeus auth failed: ${errorJson.title} (Code: ${errorJson.code || 'N/A'})`;
                 }
            } catch (parseError) { /* ignore JSON parse error, use status text */ }
            // Check for specific network/CORS related errors if possible (often vague)
            if (response.status === 0 || !response.status) { // Status 0 often indicates CORS or network error
                errorMessage = "CLIENT Network/CORS error during Amadeus authentication. Check browser console and network tab. Ensure the API endpoint allows requests from this origin (it likely doesn't for client-side calls).";
            }
            throw new Error(errorMessage);
        }

        const tokenData: AmadeusAccessToken = await response.json();
        return tokenData.access_token;
    } catch (error: any) {
        console.error("CLIENT Error fetching Amadeus access token:", error);
        // Rethrow a more specific error if possible
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             throw new Error(`CLIENT Network error or CORS issue fetching Amadeus token. API endpoint ${url} might be unreachable or blocking requests from the browser. ${error.message}`);
        }
        throw new Error(`CLIENT Failed to get Amadeus token: ${error.message}`);
    }
}

async function getCityCode_Client(cityName: string, token: string): Promise<string | null> {
    const { baseUrl } = CLIENT_AMADEUS_CONFIG;
    const url = `${baseUrl}/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(cityName)}`;
    console.log("CLIENT: Attempting to fetch city code from:", url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            // mode: 'cors', // Default, but explicitly stating
        });
        console.log("CLIENT: Amadeus city code response status:", response.status);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`CLIENT Amadeus City Lookup Error (Status ${response.status}):`, errorBody);
             if (response.status === 0 || !response.status) { // CORS or network error
                console.error("CLIENT Network/CORS error during city code lookup.");
             }
            // Don't throw an error that stops the search, just return null and let the main search handle it.
            return null;
        }

        const data = await response.json();
        if (data?.data?.length > 0) {
            // Prioritize exact city matches with IATA codes
            const cityMatch = data.data.find((loc: any) =>
                loc.subType === 'CITY' &&
                loc.iataCode &&
                loc.name?.toUpperCase() === cityName.toUpperCase()
            );
            if (cityMatch) {
                console.log(`CLIENT: Found exact city match ${cityMatch.iataCode} for ${cityName}`);
                return cityMatch.iataCode;
            }
             // Fallback: Find first CITY type with an IATA code
            const firstCityWithCode = data.data.find((loc: any) => loc.subType === 'CITY' && loc.iataCode);
             if (firstCityWithCode) {
                 console.log(`CLIENT: Found fallback city code ${firstCityWithCode.iataCode} for ${cityName}`);
                 return firstCityWithCode.iataCode;
             }
            // Fallback: Find first result with an IATA code (less ideal)
            if (data.data[0].iataCode) {
                console.log(`CLIENT: Found fallback non-city code ${data.data[0].iataCode} for ${cityName}`);
                return data.data[0].iataCode;
            }
        }
        console.warn(`CLIENT No usable city code found for: ${cityName}`);
        return null;
    } catch (error: any) {
        console.error(`CLIENT Error fetching city code for ${cityName}:`, error);
         if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             console.error(`CLIENT Network error or CORS issue fetching city code for ${cityName}. API endpoint might be unreachable or blocking requests.`);
        }
        return null; // Don't throw, allow search to handle gracefully
    }
}


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
  const [isCorsError, setIsCorsError] = useState<boolean>(false); // State for CORS/Network error
  const [bookedHotelName, setBookedHotelName] = useState<string>(''); // To show in success dialog

  const { toast } = useToast();

  useEffect(() => {
    // Simulating fetching savings data - replace with actual logic if available
    const timer = setTimeout(() => {
      setTotalSavings(1234.56);
    }, 500); // Simulate network delay
    return () => clearTimeout(timer);
  }, []);


  const handleSearch = async (criteria: HotelSearchCriteria) => {
    setIsLoading(true);
    setSearchPerformed(true);
    setSearchResults([]);
    setSearchError(null);
    setIsConfigError(false);
    setIsCorsError(false); // Reset CORS error state
    setLastSearchCriteria(criteria);
    console.log("Initiating CLIENT-SIDE Amadeus search...");

    // --- Client-Side Validation ---
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

    // --- Check for API Keys BEFORE making calls ---
     if (!CLIENT_AMADEUS_CONFIG.apiKey || !CLIENT_AMADEUS_CONFIG.apiSecret) {
         setSearchError("CLIENT ERROR: Amadeus API Key/Secret missing in configuration. Search unavailable.");
         setIsConfigError(true);
         setIsLoading(false);
         return;
     }
    // ---

    let token: string | null = null;
    let cityCode: string | null = null;

    try {
        // 1. Get Access Token (Client-Side)
        console.log("CLIENT: Getting Access Token...");
        token = await getAmadeusAccessToken_Client();
        console.log("CLIENT: Access Token obtained.");

        // 2. Get City Code (Client-Side)
        console.log(`CLIENT: Getting City Code for ${criteria.city}...`);
        cityCode = await getCityCode_Client(criteria.city, token);
         if (!cityCode) {
            // Don't throw fatal error, allow search to proceed (Amadeus might handle city name)
            // but inform user the code wasn't found. City name will be used instead.
            toast({
                title: "Location Warning",
                description: `Could not find a specific location code for "${criteria.city}". Searching by name. Results might be less accurate.`,
                variant: "default", // Use default or a custom 'warning' variant if available
            });
            console.warn(`CLIENT: No city code found for ${criteria.city}. Proceeding with city name.`);
             // Proceed without cityCode, Amadeus *might* handle the city name directly in some cases,
             // but it's less reliable than using cityCode. The API call below needs adjustment.
            // ** IMPORTANT: The search URL needs to handle missing cityCode **
         } else {
            console.log(`CLIENT: Using City Code ${cityCode}.`);
         }


        // 3. Perform Hotel Search (Client-Side)
        const checkInFormatted = criteria.checkInDate.toISOString().split('T')[0];
        const checkOutFormatted = criteria.checkOutDate.toISOString().split('T')[0];

        // ** Construct parameters carefully, especially with potentially missing cityCode **
        const params = new URLSearchParams();
        if (cityCode) {
            params.append('cityCode', cityCode);
        } else {
            // **Crucial:** If no cityCode, Amadeus Hotel Search v2 REQUIRES lat/long OR hotelIds.
            // Searching by city name alone is NOT directly supported in v2 Shopping API.
            // We cannot proceed reliably without a cityCode or coordinates.
             console.error("CLIENT: Cannot perform hotel search without cityCode or coordinates.");
             throw new Error(`Search cannot be performed for "${criteria.city}" without a valid location code. Please try a different city name or spelling known to Amadeus.`);
        }
        params.append('checkInDate', checkInFormatted);
        params.append('checkOutDate', checkOutFormatted);
        params.append('adults', criteria.numberOfGuests.toString());
        params.append('currency', 'USD');
        params.append('radius', '20'); // Search radius around the city center
        params.append('radiusUnit', 'KM');
        params.append('paymentPolicy', 'NONE'); // Filter for hotels without complex payment policies initially
        params.append('bestRateOnly', 'true'); // Try to get the best rate
        // params.append('view', 'LIGHT'); // Request less data initially

        const searchUrl = `${CLIENT_AMADEUS_CONFIG.baseUrl}/v2/shopping/hotel-offers?${params.toString()}`;
        console.log(`CLIENT: Attempting to fetch Amadeus Hotel Offers: ${searchUrl}`);

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            // mode: 'cors', // Default
        });

        console.log(`CLIENT: Amadeus Search Response Status: ${response.status}`);
        const responseBodyText = await response.text(); // Read body once

        if (!response.ok) {
            console.error("CLIENT Amadeus Search Error Body:", responseBodyText);
            let apiErrorMessage = `CLIENT Amadeus hotel search failed: ${response.status} ${response.statusText}`;
             try {
                 const errorJson = JSON.parse(responseBodyText);
                 if (errorJson.errors && errorJson.errors.length > 0) {
                   const firstError = errorJson.errors[0];
                   apiErrorMessage = `Search failed: ${firstError.title || 'Unknown API Error'}. ${firstError.detail || ''} (Code: ${firstError.code || 'N/A'})`;
                   // Check for specific errors like bad dates or location
                   if (firstError.code === 38196 || firstError.code === 477) { // Invalid date / No hotel found
                       apiErrorMessage = `No hotels found for ${criteria.city} on these dates, or the dates are invalid. Please check your search. (Code: ${firstError.code})`;
                   } else if (firstError.status === 400) { // Bad request general
                        apiErrorMessage = `Search failed: Invalid request. Please check city name, dates, and guest count. (Code: ${firstError.code})`;
                   }
                 }
             } catch (parseError) { /* Ignore, use status text */ }
             // Check for CORS/Network error again
             if (response.status === 0 || !response.status) {
                 apiErrorMessage = "CLIENT Network/CORS error during Amadeus hotel search. Check browser console and network tab. The API likely blocks direct browser requests.";
                 setIsCorsError(true); // Set CORS error flag
             }
            throw new Error(apiErrorMessage);
        }

        const data = JSON.parse(responseBodyText);

        if (data?.data?.length > 0) {
            // Filter for offers that have essential info
             const validOffers = data.data.filter((offer: AmadeusHotelOffer) =>
                offer.hotel &&
                offer.hotel.hotelId &&
                offer.hotel.name &&
                offer.offers?.[0]?.price?.total
             );
             console.log(`CLIENT: Found ${data.data.length} offers, ${validOffers.length} seem valid.`);

             if (validOffers.length > 0) {
                setSearchResults(validOffers.map(transformAmadeusHotelOffer));
             } else {
                 console.log("CLIENT: No valid offers found after filtering (missing name, ID, or price).");
                  setSearchError(`No available hotels found matching your criteria in ${criteria.city} for the selected dates. Try different dates or ensure the location is correct.`);
                 setSearchResults([]); // Explicitly set to empty
             }
        } else {
            console.log("CLIENT: No hotel data array found in response.");
            setSearchError(`No hotels found for ${criteria.city} on these dates. Please check your search criteria.`);
            setSearchResults([]); // Ensure empty results
        }

    } catch (error: any) {
        console.error("CLIENT Search failed:", error);
        const errorMessage = error.message || "An unknown error occurred during search.";
        setSearchError(errorMessage);

        // Specific error state handling
        if (errorMessage.includes("API Key/Secret missing") || errorMessage.includes("Invalid API Key or Secret")) {
            setIsConfigError(true);
        } else if (errorMessage.includes("Network error or CORS issue") || errorMessage.includes("CORS error")) {
             setIsCorsError(true); // Set CORS error flag
             // Optionally provide a more user-friendly CORS message
             setSearchError("Could not connect to the hotel search service due to network or browser security restrictions (CORS). This setup (client-side API calls) is not recommended for production.");
        } else if (errorMessage.includes("without a valid location code")) {
             // Location code specific error
              toast({
                title: "Location Error",
                description: errorMessage,
                variant: "destructive",
             });
        }
        else {
            // General API or fetch errors (non-CORS/config)
            toast({
                title: "Search Error",
                description: errorMessage,
                variant: "destructive",
            });
        }
        setSearchResults([]);
    } finally {
        setIsLoading(false);
        console.log("CLIENT Search finished.");
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
        // Call the CLIENT-SIDE booking simulation
        const bookedTrip = await simulateBookHotel_Client(
            hotelToBook,
            lastSearchCriteria.checkInDate,
            lastSearchCriteria.checkOutDate,
            lastSearchCriteria.numberOfGuests,
            paymentDetails
        );

        // Add trip to localStorage (already client-side safe)
        await addTrip(bookedTrip);

        setShowPaymentDialog(false);
        setShowBookingSuccessDialog(true);
        toast({
            title: "Booking Successful! (Simulated)",
            description: `${hotelToBook.name} has been booked.`,
        });
        setSelectedHotel(null);

    } catch (error: any) {
        console.error("CLIENT Booking simulation failed:", error);
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
        {/* Security & CORS Warning Banner */}
        <Alert variant="destructive" className="mb-8 bg-destructive/10 border-destructive/30 text-destructive">
             <AlertTriangle className="h-5 w-5 !text-destructive" /> {/* Ensure icon color is correct */}
            <AlertTitle className="font-semibold">Configuration & Security Warning</AlertTitle>
            <AlertDescription>
                Hotel data is currently being fetched directly from your browser. This is **insecure** as it exposes API credentials and often leads to **CORS errors** (browser security preventing requests to external APIs).
                <br />
                For a real application, API calls **must** be handled server-side (e.g., using Next.js API Routes or Server Actions) to protect credentials and avoid CORS issues. This client-side approach is for demonstration only.
            </AlertDescription>
        </Alert>

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
          <p className="text-lg text-foreground">Searching for eco-friendly hotels via Amadeus (Client-Side)...</p>
          <p className="text-sm text-muted-foreground">This may take a moment. Watch the browser console for details/errors.</p>
        </div>
      )}

      {/* Error State */}
       {!isLoading && searchPerformed && searchError && (
         <div className="text-center py-10">
          {isConfigError ? (
             <Alert variant="destructive" className="max-w-lg mx-auto bg-destructive/10 border-destructive/30">
                 <Info className="h-5 w-5 !text-destructive" />
                <AlertTitle className="font-semibold text-destructive">Search Configuration Error</AlertTitle>
                <AlertDescription className="text-destructive/90">
                   {searchError}
                   <p className="mt-2 text-xs">Please ensure API credentials in `src/services/booking.ts` (CLIENT_AMADEUS_CONFIG) are correct.</p>
                </AlertDescription>
            </Alert>
          ) : isCorsError ? (
             <Alert variant="destructive" className="max-w-lg mx-auto bg-destructive/10 border-destructive/30">
                 <AlertTriangle className="h-5 w-5 !text-destructive" />
                <AlertTitle className="font-semibold text-destructive">Network or CORS Error</AlertTitle>
                <AlertDescription className="text-destructive/90">
                   {searchError}
                    <p className="mt-2 text-xs">Direct browser API calls are likely blocked by CORS policy or network issues. Check the browser's console (F12) Network tab for failed requests. Server-side API calls are the standard solution.</p>
                </AlertDescription>
            </Alert>
           ): (
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
