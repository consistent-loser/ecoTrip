'use server'; // Mark this module's exports as Server Actions

import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails, AmadeusHotelOffer, AmadeusAccessToken } from '@/types';
import { format as formatDate } from 'date-fns'; // Import date-fns for formatting

// --- Amadeus API Configuration (Server-Side) ---
// Use environment variables on the server for security.
// These MUST be set in your deployment environment (e.g., Vercel, Netlify)
// and can be set locally in a .env.local file (ensure it's in .gitignore).
const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY || 'jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9';
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET || 'U1MGYukFmZhrjq40';
const AMADEUS_API_BASE_URL = process.env.AMADEUS_API_BASE_URL || 'https://test.api.amadeus.com'; // Use test API by default

// --- Helper Functions (Can run on server or client) ---

/**
 * Transforms an Amadeus hotel offer into our application's Hotel type.
 * @param offer The hotel offer object from Amadeus API.
 * @returns A Hotel object.
 */
export async function transformAmadeusHotelOffer(offer: AmadeusHotelOffer): Promise<Hotel> {
    const hotelData = offer.hotel;
    const offerDetails = offer.offers?.[0]; // Get the first offer
    const offerPrice = offerDetails?.price;

    // Placeholder image logic
    const imageUrl = hotelData.media?.[0]?.uri || `https://picsum.photos/seed/${hotelData.hotelId || Math.random()}/400/300`;

    // Address construction
    const addressParts = [hotelData.address?.lines?.[0], hotelData.address?.cityName, hotelData.address?.postalCode, hotelData.address?.countryCode];
    const address = addressParts.filter(Boolean).join(', ');

    // Rating
    const rating = hotelData.rating ? parseInt(hotelData.rating, 10) : 0;

    // Amenities
    const amenities = hotelData.amenities || [];

    // Description
    const roomDescription = offerDetails?.room?.description?.text;
    const hotelDescription = hotelData.description?.text;
    const description = roomDescription || hotelDescription || `Eco-friendly stay at ${hotelData.name || 'this hotel'} in ${hotelData.address?.cityName || 'the city'}. Check availability for details.`;

    return {
        id: hotelData.hotelId || `unknown-${Math.random()}`,
        name: hotelData.name || 'Hotel Name Unavailable',
        address: address || 'Address Unavailable',
        city: hotelData.address?.cityName || 'City Unavailable',
        pricePerNight: offerPrice?.total ? parseFloat(offerPrice.total) : 0,
        imageUrl: imageUrl,
        rating: rating > 0 && rating <= 5 ? rating : parseFloat((Math.random() * 1.5 + 3).toFixed(1)), // Ensure number
        amenities: amenities.slice(0, 6),
        latitude: hotelData.latitude,
        longitude: hotelData.longitude,
        description: description,
        currency: offerPrice?.currency || 'USD',
    };
}

// --- Amadeus API Interaction (Server Actions) ---

let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Gets an Amadeus API access token, caching it for reuse. SERVER-SIDE ONLY.
 * @returns The access token string.
 * @throws Error if authentication fails.
 */
async function getAmadeusAccessToken(): Promise<string> {
  const now = Date.now();

  // Check cache first
  if (cachedToken && cachedToken.expiry > now) {
    // console.log("Using cached Amadeus token.");
    return cachedToken.token;
  }

  // Ensure API keys are available (redundant check, but safe)
  if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
    console.error("SERVER FATAL: Missing Amadeus API Key/Secret in environment variables.");
    throw new Error("Server configuration error: API credentials missing.");
  }

  const url = `${AMADEUS_API_BASE_URL}/v1/security/oauth2/token`;
  console.log(`SERVER: Requesting new Amadeus token from: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`,
      cache: 'no-store', // Ensure fresh token request
    });

    const responseBodyText = await response.text(); // Read body once for potential logging

    if (!response.ok) {
        console.error(`SERVER Amadeus Auth Error Response (Status ${response.status}):`, responseBodyText);
        let errorMessage = `Amadeus auth failed: ${response.status} ${response.statusText}`;
         try {
             const errorJson = JSON.parse(responseBodyText);
             if (errorJson.error === 'invalid_client') {
                 errorMessage = `Amadeus auth failed: Invalid API Key or Secret provided. Check server environment variables. (Code: ${errorJson.code || 'N/A'})`;
             } else if (errorJson.title) {
                 errorMessage = `Amadeus auth failed: ${errorJson.title} (Code: ${errorJson.code || 'N/A'})`;
             }
         } catch (parseError) { /* ignore JSON parse error, use status text */ }
        throw new Error(errorMessage);
    }

    const tokenData: AmadeusAccessToken = JSON.parse(responseBodyText);
    const expiryTime = now + (tokenData.expires_in * 1000) - 60000; // Add buffer (60s)
    cachedToken = { token: tokenData.access_token, expiry: expiryTime };
    console.log("SERVER: New Amadeus token obtained and cached.");
    return tokenData.access_token;

  } catch (error: any) {
    console.error("SERVER Error fetching Amadeus access token:", error);
    // Don't expose raw error message potentially containing secrets
    throw new Error(`Failed to get Amadeus token: ${error.message.includes('Invalid API Key or Secret') ? 'Invalid Credentials' : 'Authentication Error'}`);
  }
}

/**
 * Gets the IATA city code for a given city name using Amadeus API. SERVER-SIDE ONLY.
 * @param cityName The name of the city.
 * @param token Amadeus access token.
 * @returns The city code string or null if not found.
 */
async function getCityCode(cityName: string, token: string): Promise<string | null> {
    const url = `${AMADEUS_API_BASE_URL}/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(cityName)}`;
    console.log(`SERVER: Fetching city code for "${cityName}" from: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            cache: 'force-cache', // City codes don't change often
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`SERVER Amadeus City Lookup Error (Status ${response.status}) for "${cityName}":`, errorBody);
            // Don't throw, let the main search function handle null city code
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
                console.log(`SERVER: Found exact city match ${cityMatch.iataCode} for ${cityName}`);
                return cityMatch.iataCode;
            }
             // Fallback: Find first CITY type with an IATA code
            const firstCityWithCode = data.data.find((loc: any) => loc.subType === 'CITY' && loc.iataCode);
             if (firstCityWithCode) {
                 console.log(`SERVER: Found fallback city code ${firstCityWithCode.iataCode} for ${cityName}`);
                 return firstCityWithCode.iataCode;
             }
            // Fallback: Find first result with an IATA code (less ideal)
             if (data.data[0].iataCode) {
                 console.log(`SERVER: Found fallback non-city code ${data.data[0].iataCode} for ${cityName}`);
                 return data.data[0].iataCode;
             }
        }
        console.warn(`SERVER No usable city code found for: ${cityName}`);
        return null;
    } catch (error: any) {
        console.error(`SERVER Error fetching city code for ${cityName}:`, error);
        return null; // Don't throw, handle gracefully
    }
}


/**
 * Searches for hotels using the Amadeus API V1. SERVER ACTION.
 * @param criteria The search criteria.
 * @returns A promise resolving to an array of Hotel objects.
 * @throws Error if the search fails or API is misconfigured.
 */
export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
    console.log("SERVER ACTION: searchHotels (v1) called with criteria:", criteria);

    // Validate required criteria for Amadeus
    if (!criteria.city || !criteria.checkInDate || !criteria.checkOutDate || !criteria.numberOfGuests) {
        throw new Error("Missing required search criteria (City, Dates, Guests).");
    }

    // Check if API keys are missing - Crucial first step
    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
        const message = "CRITICAL (Server): Amadeus API Key/Secret are missing. Cannot proceed with search. Ensure AMADEUS_API_KEY and AMADEUS_API_SECRET are set in server environment.";
        console.error(message);
        throw new Error("API credentials missing. Search cannot be performed."); // Throw error to inform UI
    }

    let token: string | null = null;
    let cityCode: string | null = null;

    try {
        // 1. Get Access Token
        console.log("SERVER: Getting Access Token...");
        token = await getAmadeusAccessToken();
        console.log("SERVER: Access Token obtained.");

        // 2. Get City Code
        console.log(`SERVER: Getting City Code for ${criteria.city}...`);
        cityCode = await getCityCode(criteria.city, token);
         if (!cityCode) {
             console.warn(`SERVER: No city code found for ${criteria.city}. Search might fail or be inaccurate.`);
              throw new Error(`Search cannot be performed for "${criteria.city}" without a valid location code. Please try a different city name or spelling known to Amadeus.`);
         } else {
            console.log(`SERVER: Using City Code ${cityCode}.`);
         }

        // 3. Perform Hotel Search using Amadeus V1
        // Format dates correctly (YYYY-MM-DD)
        const checkInFormatted = formatDate(criteria.checkInDate, 'yyyy-MM-dd');
        const checkOutFormatted = formatDate(criteria.checkOutDate, 'yyyy-MM-dd');

        const params = new URLSearchParams();
         if (cityCode) {
             params.append('cityCode', cityCode);
         } else {
               console.error("SERVER: Critical error - cityCode is null, cannot proceed with Amadeus v1 search.");
               throw new Error("Location code could not be determined for the search.");
         }
        params.append('checkInDate', checkInFormatted);
        params.append('checkOutDate', checkOutFormatted);
        params.append('adults', criteria.numberOfGuests.toString());
        // V1 specific or commonly used parameters:
        // params.append('radius', '20'); // Search radius
        // params.append('radiusUnit', 'KM');
        // params.append('currency', 'USD'); // Usually defaults or can be set
        // params.append('lang', 'EN');
        // params.append('view', 'LIGHT'); // LIGHT view might be faster

        // *** Change endpoint to v1 ***
        const searchUrl = `${AMADEUS_API_BASE_URL}/v1/shopping/hotel-offers?${params.toString()}`;
        console.log(`SERVER: Attempting to fetch Amadeus V1 Hotel Offers: ${searchUrl}`);

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            cache: 'no-store', // Don't cache search results
        });

        console.log(`SERVER: Amadeus V1 Search Response Status: ${response.status}`);
        const responseBodyText = await response.text(); // Read body once

        if (!response.ok) {
            console.error("SERVER Amadeus V1 Search Error Body:", responseBodyText);
            let apiErrorMessage = `Amadeus v1 hotel search failed: ${response.status} ${response.statusText}`;
            let errorCode: string | number = response.status; // Default to HTTP status
             try {
                 const errorJson = JSON.parse(responseBodyText);
                 if (errorJson.errors && errorJson.errors.length > 0) {
                   const firstError = errorJson.errors[0];
                   errorCode = firstError.code || errorCode; // Use Amadeus code if available
                   apiErrorMessage = `Search failed: ${firstError.title || 'Unknown API Error'}. ${firstError.detail || ''} (${errorCode})`;
                   // Specific error handling based on code
                   if (errorCode === 38196 || errorCode === 477) { // Invalid date / No hotel found
                       apiErrorMessage = `No hotels found for ${criteria.city} on these dates, or the dates are invalid. Please check your search. (${errorCode})`;
                   } else if (firstError.status === 400) { // Bad request general
                        apiErrorMessage = `Search failed: Invalid request. Check city name, dates, and guest count. (${errorCode})`;
                   }
                 }
             } catch (parseError) { /* Ignore, use status text */ }
            throw new Error(apiErrorMessage); // Throw the constructed error message
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
             console.log(`SERVER: Found ${data.data.length} offers (v1), ${validOffers.length} seem valid.`);

             if (validOffers.length > 0) {
                 // Transform valid offers using the helper function
                 // Use Promise.all since transformAmadeusHotelOffer is async now
                 return Promise.all(validOffers.map(transformAmadeusHotelOffer));
             } else {
                 console.log("SERVER: No valid offers found after filtering (missing name, ID, or price).");
                  return []; // Return empty array, UI will show "No results"
             }
        } else {
            console.log("SERVER: No hotel data array found in v1 response.");
            return []; // Return empty array
        }

    } catch (error: any) {
        console.error("-----------------------------------------");
        console.error("SERVER Error during Amadeus v1 hotel search process:");
        console.error(`Timestamp: ${new Date().toISOString()}`);
        if (token) console.error("Token used: YES (obtained successfully)"); else console.error("Token used: NO (failed to obtain or not reached)");
        if (cityCode) console.error(`City Code used: ${cityCode}`); else console.error(`City Code used: NO (failed lookup or not reached)`);
        console.error("Search Criteria:", criteria);
        console.error("Error Message:", error.message);
        // Removed detailed stack trace logging for brevity in this context, can be re-added if needed for deep debugging
        // console.error("Stack Trace:", error.stack);
        console.error("-----------------------------------------");

        // Rethrow the error so the client-side UI can catch it and display a message
        // Ensure the message is somewhat user-friendly
         let userMessage = "An error occurred during the hotel search.";
         if (error.message.includes("API credentials missing")) {
             userMessage = "Server configuration error: API credentials missing.";
         } else if (error.message.includes("Amadeus auth failed")) {
             userMessage = `Authentication with the hotel service failed. ${error.message.includes('Invalid API Key or Secret') ? ' (Invalid Credentials)' : ''}`;
         } else if (error.message.includes("Search failed") || error.message.includes("No hotels found")) {
             // Use the specific message constructed earlier if available
             userMessage = error.message;
         } else if (error.message.includes("Location code could not be determined")) {
             userMessage = error.message; // Pass the specific location error
         }

        // Propagate a new error with the user-friendly message
        throw new Error(userMessage);
    }
}

/**
 * Simulates booking a hotel. SERVER ACTION.
 * This function would interact with Amadeus's booking APIs in a real app.
 * @param hotel The hotel to book.
 * @param checkInDate Check-in date.
 * @param checkOutDate Check-out date.
 * @param numberOfGuests Number of guests.
 * @param paymentDetails Payment details (used for simulation logic).
 * @returns A promise resolving to the created Trip object.
 * @throws Error if the simulated booking fails.
 */
export async function simulateBookHotel(
  hotel: Hotel,
  checkInDate: Date,
  checkOutDate: Date,
  numberOfGuests: number,
  paymentDetails: PaymentDetails // Payment details are passed but only used for simulation logic
): Promise<Trip> {
  console.log("SERVER ACTION: simulateBookHotel called for hotel:", hotel.name);
  console.log("Payment method (simulated):", paymentDetails.method);

  // TODO: Add real Amadeus booking API calls here in a production app.
  // This would involve:
  // 1. Re-fetching the specific offer price using the offer ID (to ensure price hasn't changed).
  //    - Requires passing the offer ID from the client during the 'Book Now' click.
  //    - Amadeus API: GET /v1/shopping/hotel-offers/{offerId} (or similar pricing endpoint) - Note: V1 might use different endpoint
  // 2. Creating the booking with traveler details and payment info.
  //    - Amadeus API: POST /v1/booking/hotel-bookings
  //    - This requires handling sensitive traveler data securely.

  // Simulate network delay for the booking process
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Basic simulation logic: Check if payment method seems valid (for simulation)
  let paymentValid = false;
  if (paymentDetails.method === 'creditCard' || paymentDetails.method === 'debitCard') {
    paymentValid = !!paymentDetails.cardNumber && !!paymentDetails.expiryDate && !!paymentDetails.cvc;
  } else if (paymentDetails.method === 'paypal') {
    paymentValid = !!paymentDetails.paypalEmail;
  }

  if (!paymentValid) {
     console.error("SERVER ACTION: Simulated payment validation failed.");
    throw new Error("Simulated payment validation failed. Please check payment details.");
  }

  // Simulate successful booking
  const totalPrice = hotel.pricePerNight; // Assuming pricePerNight is total stay price

  const newTrip: Trip = {
    id: `trip-amadeus-server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hotel,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice: totalPrice,
    status: 'upcoming', // Default status for new booking
  };

  console.log("SERVER ACTION: Booking successful (simulated):", newTrip.id);
  // The trip data is returned to the client, which then calls addTrip (localStorage).
  return newTrip;
}


// --- Local Storage Trip Management (Client-Side Functions) ---
// These functions interact with localStorage and are intended to be called
// directly from client components. They are NOT server actions.

/**
 * Retrieves all trips from localStorage. Client-side only.
 */
export async function getTrips(): Promise<Trip[]> {
  // This check prevents the function from running on the server during SSR/build
  if (typeof window === 'undefined') {
    // console.warn("Attempted to call getTrips (localStorage) on the server. Returning empty array.");
    return [];
  }
  try {
    const tripsJson = localStorage.getItem('ecoTrips');
    if (tripsJson) {
      const parsedTrips: any[] = JSON.parse(tripsJson);
      // Ensure dates are properly converted back to Date objects and filter invalid entries
      return parsedTrips.map(trip => ({
        ...trip,
        checkInDate: trip.checkInDate ? new Date(trip.checkInDate) : new Date(),
        checkOutDate: trip.checkOutDate ? new Date(trip.checkOutDate): new Date(),
        hotel: trip.hotel || {}, // Ensure hotel object exists
      })).filter(trip => trip.hotel && trip.hotel.id && !isNaN(trip.checkInDate.getTime()) && !isNaN(trip.checkOutDate.getTime()));
    }
  } catch (error) {
    console.error("CLIENT: Failed to parse trips from localStorage:", error);
    localStorage.removeItem('ecoTrips'); // Clear corrupted data
  }
  return [];
}

/**
 * Adds a new trip to localStorage. Client-side only.
 */
export async function addTrip(trip: Trip): Promise<void> {
  if (typeof window === 'undefined') {
    return; // Don't run on server
  }
    try {
        const existingTrips = await getTrips(); // Ensures we get valid, parsed trips
        const updatedTrips = [...existingTrips, trip];
        localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
        console.log("CLIENT: Trip added to localStorage:", trip.id);
    } catch (error) {
        console.error("CLIENT: Failed to save trip to localStorage:", error);
    }
}

/**
 * Removes a trip from localStorage by ID. Client-side only.
 */
export async function removeTrip(tripId: string): Promise<void> {
  if (typeof window === 'undefined') {
    return; // Don't run on server
  }
    try {
      let existingTrips = await getTrips();
      const updatedTrips = existingTrips.filter(trip => trip.id !== tripId);
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
      console.log("CLIENT: Trip removed from localStorage:", tripId);
    } catch (error) {
      console.error("CLIENT: Failed to remove trip from localStorage:", error);
    }
}

/**
 * Updates a trip in localStorage (e.g., changing status). Client-side only.
 */
export async function updateTrip(updatedTrip: Trip): Promise<void> {
 if (typeof window === 'undefined') {
    return; // Don't run on server
  }
    try {
      let existingTrips = await getTrips();
      const updatedTrips = existingTrips.map(trip =>
        trip.id === updatedTrip.id ? updatedTrip : trip
      );
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
       console.log("CLIENT: Trip updated in localStorage:", updatedTrip.id);
    } catch (error) {
      console.error("CLIENT: Failed to update trip in localStorage:", error);
    }
}

// Removed CLIENT_AMADEUS_CONFIG constant
