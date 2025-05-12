
'use server'; // Mark this module's exports as Server Actions

import type {
    Hotel, HotelSearchCriteria, Trip, PaymentDetails, AmadeusHotelOffer, AmadeusAccessToken,
    LocationSuggestion, AmadeusLocation, AmadeusLocationApiResponse
} from '@/types';
import { format as formatDate } from 'date-fns'; // Import date-fns for formatting

// --- Amadeus API Configuration (Server-Side) ---
// Use environment variables on the server for security.
const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY || 'jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9';
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET || 'U1MGYukFmZhrjq40';
const AMADEUS_API_BASE_URL = process.env.AMADEUS_API_BASE_URL || 'https://test.api.amadeus.com'; // Use test API by default

// --- Helper Functions ---

/**
 * Transforms an Amadeus hotel offer into our application's Hotel type.
 * @param offer The hotel offer object from Amadeus API (V2 structure).
 * @returns A Hotel object.
 */
export async function transformAmadeusHotelOffer(offer: AmadeusHotelOffer): Promise<Hotel> {
    const hotelData = offer.hotel;
    const offerDetails = offer.offers?.[0]; // Get the first offer
    const offerPrice = offerDetails?.price;

    // Placeholder image logic - Use a consistent placeholder or improve later
    const imageUrl = `https://picsum.photos/seed/${hotelData.hotelId || Math.random()}/400/300`;
    // In a real app, you might call the Hotel Details API (e.g., GET /v3/shopping/hotel-offers/{offerId})
    // to get actual hotel images if the Offers API doesn't provide them.
    // const imageUrl = hotelData.media?.[0]?.uri || `https://picsum.photos/seed/${hotelData.hotelId || Math.random()}/400/300`;

    // Address construction
    const addressParts = [hotelData.address?.lines?.[0], hotelData.address?.cityName, hotelData.address?.postalCode, hotelData.address?.countryCode];
    const address = addressParts.filter(Boolean).join(', ');

    // Rating - Amadeus rating is often a string, convert carefully
    const ratingValue = hotelData.rating ? parseInt(hotelData.rating, 10) : 0;
    const rating = isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5
      ? parseFloat((Math.random() * 1.5 + 3.0).toFixed(1)) // Fallback random rating if invalid
      : ratingValue;

    // Amenities - Often limited in the Offers V2 response, might need Details API
    const amenities = hotelData.amenities?.slice(0, 6) || []; // Take first 6 or empty array

    // Description - Prefer room description if available
    const roomDescription = offerDetails?.room?.description?.text;
    // Hotel description might require a separate API call or view=FULL (which is slower)
    // const hotelDescription = hotelData.description?.text;
    const description = roomDescription || `Eco-friendly stay at ${hotelData.name || 'this hotel'} in ${hotelData.address?.cityName || 'the city'}. Check availability for details.`;

    return {
        id: hotelData.hotelId || `unknown-${Math.random()}`,
        name: hotelData.name || 'Hotel Name Unavailable',
        address: address || 'Address Unavailable',
        city: hotelData.address?.cityName || 'City Unavailable',
        pricePerNight: offerPrice?.total ? parseFloat(offerPrice.total) : 0, // V2 often provides TOTAL price
        imageUrl: imageUrl,
        rating: rating, // Use the validated/fallback rating
        amenities: amenities,
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
 * @throws Error if authentication fails or credentials missing.
 */
async function getAmadeusAccessToken(): Promise<string> {
  const now = Date.now();

  // Check cache first
  if (cachedToken && cachedToken.expiry > now) {
    // console.log("Using cached Amadeus token.");
    return cachedToken.token;
  }

  // Ensure API keys are available
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
    throw new Error(`Failed to get Amadeus token: ${error.message.includes('Invalid API Key or Secret') ? 'Invalid Credentials' : 'Authentication Error'}`);
  }
}

/**
 * Gets the IATA city code for a given city name using Amadeus API. SERVER-SIDE ONLY.
 * Tries to find an exact match first, then falls back to the first city with an IATA code.
 * @param cityName The name of the city.
 * @param token Amadeus access token.
 * @returns The city code string or null if not found/error.
 */
async function getCityCode(cityName: string, token: string): Promise<string | null> {
    // Use /v1/reference-data/locations/cities for potentially better city matching
    const url = `${AMADEUS_API_BASE_URL}/v1/reference-data/locations/cities?keyword=${encodeURIComponent(cityName)}`;
    console.log(`SERVER: Fetching city code for "${cityName}" from: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'force-cache', // City codes don't change often
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`SERVER Amadeus City Lookup Error (Status ${response.status}) for "${cityName}":`, errorBody);
            return null; // Don't throw, handle gracefully
        }

        const data: AmadeusLocationApiResponse = await response.json();

        if (data?.data?.length > 0) {
             // Prioritize exact city matches with IATA codes
             const exactMatch = data.data.find((loc: AmadeusLocation) =>
                loc.subType === 'CITY' &&
                loc.iataCode &&
                loc.name?.toUpperCase() === cityName.toUpperCase()
             );
             if (exactMatch && exactMatch.iataCode) {
                console.log(`SERVER: Found exact city match ${exactMatch.iataCode} for ${cityName}`);
                return exactMatch.iataCode;
             }

             // Fallback: Find first CITY result with an IATA code
             const firstCityMatch = data.data.find(loc => loc.subType === 'CITY' && loc.iataCode);
             if (firstCityMatch && firstCityMatch.iataCode) {
                 console.log(`SERVER: Found fallback city code ${firstCityMatch.iataCode} for ${cityName}`);
                 return firstCityMatch.iataCode;
             }
        }
        console.warn(`SERVER No usable CITY IATA code found for: ${cityName}`);
        return null;
    } catch (error: any) {
        console.error(`SERVER Error fetching city code for ${cityName}:`, error);
        return null; // Don't throw, handle gracefully
    }
}

/**
 * Fetches location suggestions from Amadeus based on user input. SERVER ACTION.
 * @param query The user's input string.
 * @returns A promise resolving to an array of LocationSuggestion objects.
 */
export async function suggestLocations(query: string): Promise<LocationSuggestion[]> {
    console.log(`SERVER ACTION: suggestLocations called with query: "${query}"`);

    if (!query || query.trim().length < 2) { // Avoid searching for very short strings
        return [];
    }

    // Check API key configuration first
    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
      console.error("SERVER ACTION (suggestLocations): Missing Amadeus API Key/Secret.");
      // Don't throw, just return empty array for suggestions
      return [];
    }

    let token: string;
    try {
        token = await getAmadeusAccessToken();
    } catch (error) {
        console.error("SERVER ACTION (suggestLocations): Failed to get token:", error);
        return []; // Cannot proceed without token
    }

    // Use /v1/reference-data/locations?subType=CITY,AIRPORT&keyword=...
    const params = new URLSearchParams();
    params.append('subType', 'CITY'); // Focus on cities for hotel search context
    params.append('keyword', query);
    params.append('page[limit]', '5'); // Limit suggestions
    params.append('sort', 'analytics.travelers.score'); // Sort by relevance/popularity
    params.append('view', 'LIGHT'); // Request less data

    const url = `${AMADEUS_API_BASE_URL}/v1/reference-data/locations?${params.toString()}`;
    console.log(`SERVER (suggestLocations): Fetching from: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store', // Suggestions should be fresh
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`SERVER Amadeus Location Suggestion Error (Status ${response.status}):`, errorBody);
            return []; // Return empty on error
        }

        const data: AmadeusLocationApiResponse = await response.json();

        if (data?.data?.length > 0) {
            // Transform the response into our LocationSuggestion format
            return data.data
                .filter(loc => loc.subType === 'CITY' && loc.iataCode) // Ensure it's a city with an IATA code
                .map((loc: AmadeusLocation): LocationSuggestion => ({
                    id: loc.iataCode || loc.id, // Prefer IATA code as ID
                    name: `${loc.name}${loc.address?.countryCode ? `, ${loc.address.countryCode}` : ''}`, // e.g., "Paris, FR"
                    iataCode: loc.iataCode,
                    subType: loc.subType,
                    address: {
                        cityName: loc.address?.cityName,
                        countryName: loc.address?.countryName,
                        countryCode: loc.address?.countryCode,
                    },
                }));
        } else {
            console.log(`SERVER (suggestLocations): No locations found for query "${query}".`);
            return [];
        }

    } catch (error: any) {
        console.error(`SERVER Error fetching location suggestions for "${query}":`, error);
        return [];
    }
}


/**
 * Searches for hotels using the Amadeus API V2. SERVER ACTION.
 * @param criteria The search criteria, requires cityCode.
 * @returns A promise resolving to an array of Hotel objects.
 * @throws Error if the search fails, API is misconfigured, or criteria are invalid.
 */
export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
    console.log("SERVER ACTION: searchHotels (v2) called with criteria:", criteria);

    // --- Criteria Validation ---
    // V2 Requires cityCode, checkInDate, checkOutDate, numberOfGuests
    if (!criteria.cityCode) {
       // If cityCode is missing, try to derive it from the city name
        if (!criteria.city) {
            throw new Error("Missing required search criteria: City name or City Code is required.");
        }
        console.warn(`SERVER: cityCode missing, attempting lookup for city: ${criteria.city}`);
         try {
            const tokenForLookup = await getAmadeusAccessToken();
            criteria.cityCode = await getCityCode(criteria.city, tokenForLookup);
            if (!criteria.cityCode) {
                throw new Error(`Could not determine location code for city: "${criteria.city}". Please select a valid location.`);
            }
             console.log(`SERVER: Using derived cityCode ${criteria.cityCode} for search.`);
         } catch(lookupError: any){
             // Catch errors from token/city lookup specifically
             throw new Error(`Failed to prepare search: ${lookupError.message}`);
         }
    }
    if (!criteria.checkInDate || !criteria.checkOutDate || !criteria.numberOfGuests) {
        throw new Error("Missing required search criteria: Check-in/out dates and number of guests are required.");
    }
    if (criteria.checkOutDate <= criteria.checkInDate) {
        throw new Error("Validation Error: Check-out date must be after check-in date.");
    }
    // Basic check for guests
    if (criteria.numberOfGuests < 1) {
        throw new Error("Validation Error: Number of guests must be at least 1.");
    }

    // --- API Key Check ---
    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
        const message = "CRITICAL (Server): Amadeus API Key/Secret are missing. Cannot proceed with search. Ensure AMADEUS_API_KEY and AMADEUS_API_SECRET are set in server environment.";
        console.error(message);
        throw new Error("API credentials missing. Search cannot be performed.");
    }

    let token: string | null = null;

    try {
        // 1. Get Access Token
        console.log("SERVER: Getting Access Token...");
        token = await getAmadeusAccessToken();
        console.log("SERVER: Access Token obtained.");

        // City code is now expected to be in criteria.cityCode

        // 3. Perform Hotel Search using Amadeus V2
        // Format dates correctly (YYYY-MM-DD)
        const checkInFormatted = formatDate(criteria.checkInDate, 'yyyy-MM-dd');
        const checkOutFormatted = formatDate(criteria.checkOutDate, 'yyyy-MM-dd');

        const params = new URLSearchParams();
        params.append('cityCode', criteria.cityCode); // V2 requires cityCode
        params.append('checkInDate', checkInFormatted);
        params.append('checkOutDate', checkOutFormatted);
        params.append('adults', criteria.numberOfGuests.toString());
        params.append('roomQuantity', '1'); // Assuming 1 room
        params.append('ratings', '2,3,4,5'); // Example: Only search for 2-star and above
        params.append('currency', 'USD');
        params.append('lang', 'EN');
        params.append('view', 'LIGHT'); // Faster response, fewer details

        const searchUrl = `${AMADEUS_API_BASE_URL}/v2/shopping/hotel-offers?${params.toString()}`;
        console.log(`SERVER: Attempting to fetch Amadeus V2 Hotel Offers: ${searchUrl}`);

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store', // Don't cache search results
        });

        console.log(`SERVER: Amadeus V2 Search Response Status: ${response.status}`);
        const responseBodyText = await response.text(); // Read body once

        if (!response.ok) {
            console.error("SERVER Amadeus V2 Search Error Body:", responseBodyText);
            let apiErrorMessage = `Amadeus v2 hotel search failed: ${response.status} ${response.statusText}`;
            let errorCode: string | number = response.status;
             try {
                 const errorJson = JSON.parse(responseBodyText);
                 if (errorJson.errors && errorJson.errors.length > 0) {
                   const firstError = errorJson.errors[0];
                   errorCode = firstError.code || errorCode;
                   apiErrorMessage = `Search failed: ${firstError.title || 'Unknown API Error'}. ${firstError.detail || ''} (${errorCode})`;
                   // Specific error handling
                   if (errorCode === 38196 || errorCode === 477 || errorCode === 574) {
                       apiErrorMessage = `No hotels found for ${criteria.city || criteria.cityCode} on these dates, or the dates/parameters are invalid. Please check your search. (${errorCode})`;
                   } else if (firstError.status === 400) {
                        apiErrorMessage = `Search failed: Invalid request. Check location, dates, and guest count. (${errorCode})`;
                   }
                 }
             } catch (parseError) { /* Ignore */ }
            throw new Error(apiErrorMessage);
        }

        const data = JSON.parse(responseBodyText);

        if (data?.data?.length > 0) {
             const validOffers = data.data.filter((offer: AmadeusHotelOffer) =>
                offer.hotel && offer.hotel.hotelId && offer.hotel.name &&
                offer.available && offer.offers?.[0]?.price?.total
             );
             console.log(`SERVER: Found ${data.data.length} offers (v2), ${validOffers.length} seem valid and available.`);

             if (validOffers.length > 0) {
                 return Promise.all(validOffers.map(transformAmadeusHotelOffer));
             } else {
                 console.log("SERVER: No valid/available offers found after filtering.");
                  return [];
             }
        } else {
            console.log("SERVER: No hotel data array found in v2 response.");
            return [];
        }

    } catch (error: any) {
        console.error("-----------------------------------------");
        console.error("SERVER Error during Amadeus v2 hotel search process:");
        console.error(`Timestamp: ${new Date().toISOString()}`);
        if (token) console.error("Token used: YES (obtained successfully)"); else console.error("Token used: NO (failed to obtain or not reached)");
        if (criteria.cityCode) console.error(`City Code used: ${criteria.cityCode}`); else console.error(`City Code used: NO (not provided or lookup failed)`);
        console.error("Search Criteria:", criteria);
        console.error("Error Message:", error.message);
        console.error("-----------------------------------------");

        let userMessage = "An error occurred during the hotel search.";
         if (error.message.includes("API credentials missing")) {
             userMessage = "Server configuration error: API credentials missing.";
         } else if (error.message.includes("Amadeus auth failed")) {
             userMessage = `Authentication with the hotel service failed. ${error.message.includes('Invalid Credentials') ? ' (Invalid Credentials)' : ''}`;
         } else if (error.message.includes("Search failed") || error.message.includes("No hotels found")) {
             userMessage = error.message; // Use specific message from API if available
         } else if (error.message.includes("Could not determine location code") || error.message.includes("Failed to prepare search")) {
             userMessage = error.message; // Pass specific lookup/preparation error
         } else if (error.message.includes("Validation Error:")) {
             userMessage = error.message; // Pass validation error
         }
        throw new Error(userMessage);
    }
}

/**
 * Simulates booking a hotel. SERVER ACTION.
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
  paymentDetails: PaymentDetails
): Promise<Trip> {
  console.log("SERVER ACTION: simulateBookHotel called for hotel:", hotel.name);
  console.log("Payment method (simulated):", paymentDetails.method);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

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

  const totalPrice = hotel.pricePerNight; // Assuming total price

  const newTrip: Trip = {
    id: `trip-amadeus-server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hotel,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice: totalPrice,
    status: 'upcoming',
  };

  console.log("SERVER ACTION: Booking successful (simulated):", newTrip.id);
  return newTrip;
}


// --- Local Storage Trip Management (Client-Side Functions) ---

/**
 * Retrieves all trips from localStorage. Client-side only.
 */
export async function getTrips(): Promise<Trip[]> {
  if (typeof window === 'undefined') return [];
  try {
    const tripsJson = localStorage.getItem('ecoTrips');
    if (tripsJson) {
      const parsedTrips: any[] = JSON.parse(tripsJson);
      return parsedTrips.map(trip => ({
        ...trip,
        checkInDate: trip.checkInDate ? new Date(trip.checkInDate) : new Date(),
        checkOutDate: trip.checkOutDate ? new Date(trip.checkOutDate): new Date(),
        hotel: trip.hotel || {},
      })).filter(trip => trip.hotel && trip.hotel.id && !isNaN(trip.checkInDate.getTime()) && !isNaN(trip.checkOutDate.getTime()));
    }
  } catch (error) {
    console.error("CLIENT: Failed to parse trips from localStorage:", error);
    localStorage.removeItem('ecoTrips');
  }
  return [];
}

/**
 * Adds a new trip to localStorage. Client-side only.
 */
export async function addTrip(trip: Trip): Promise<void> {
  if (typeof window === 'undefined') return;
    try {
        const existingTrips = await getTrips();
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
  if (typeof window === 'undefined') return;
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
 if (typeof window === 'undefined') return;
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
