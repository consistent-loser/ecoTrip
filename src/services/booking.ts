
'use server'; // Mark this module's exports as Server Actions

import type {
    Hotel, HotelSearchCriteria, Trip, PaymentDetails, AmadeusHotelOffer, AmadeusAccessToken,
    LocationSuggestion, AmadeusLocation, AmadeusLocationApiResponse
} from '@/types';
import { format as formatDate } from 'date-fns'; // Import date-fns for formatting

// --- Amadeus API Configuration (Server-Side) ---
// Rely solely on environment variables for credentials
const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;
const AMADEUS_API_BASE_URL = process.env.AMADEUS_API_BASE_URL || 'https://test.api.amadeus.com'; // Use test API by default

// --- Helper Functions ---

/**
 * Transforms an Amadeus hotel offer into our application's Hotel type.
 * Adjusted for potential variations in V2 response. SERVER-SIDE ONLY.
 * @param offer The hotel offer object from Amadeus API (V2 structure).
 * @returns A Hotel object.
 */
export async function transformAmadeusHotelOffer(offer: AmadeusHotelOffer): Promise<Hotel> {
    const hotelData = offer.hotel;
    const offerDetails = offer.offers?.[0]; // Get the first offer
    const offerPrice = offerDetails?.price;

    // Placeholder image logic - Use a consistent placeholder or improve later
    const imageUrl = hotelData.media?.[0]?.uri || `https://picsum.photos/seed/${hotelData.hotelId || Math.random()}/400/300`;
    // In a real app, you might call the Hotel Details API (e.g., GET /v3/shopping/hotel-offers/{offerId})
    // to get actual hotel images if the Offers API doesn't provide them.

    // Address construction
    const addressParts = [hotelData.address?.lines?.[0], hotelData.address?.cityName, hotelData.address?.postalCode, hotelData.address?.countryCode];
    const address = addressParts.filter(Boolean).join(', ');

    // Rating - Amadeus rating is often a string, convert carefully
    const ratingValue = hotelData.rating ? parseInt(hotelData.rating, 10) : 0;
    const rating = isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5
      ? parseFloat((Math.random() * 1.5 + 3.0).toFixed(1)) // Fallback random rating if invalid
      : ratingValue;

    // Amenities - Often limited in the Offers V2 response, might need Details API
    // Map Amadeus codes/keywords to readable names if needed here or in the component
    const amenities = hotelData.amenities?.slice(0, 6) || []; // Take first 6 or empty array

    // Description - Prefer room description if available, then hotel description
    const roomDescription = offerDetails?.room?.description?.text;
    const hotelDescription = hotelData.description?.text;
    const description = roomDescription || hotelDescription || `Eco-friendly stay at ${hotelData.name || 'this hotel'} in ${hotelData.address?.cityName || 'the city'}. Check availability for details.`;

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

  // Ensure API keys are available from environment variables
  if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
    console.error("SERVER FATAL: Missing Amadeus API Key/Secret in environment variables. Ensure AMADEUS_API_KEY and AMADEUS_API_SECRET are correctly set.");
    // Throw a specific error indicating configuration issue
    throw new Error("Server configuration error: API credentials missing or invalid.");
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
    // Check if the error is due to invalid credentials specifically
     const detailedMessage = error.message.includes('Invalid API Key or Secret')
        ? 'Invalid Credentials'
        : error.message.includes('Amadeus auth failed')
            ? error.message // Use the specific auth failure message
            : error.message.includes('Server configuration error') // Pass through config error
                ? error.message
                : 'Authentication Error';
    throw new Error(`Failed to get Amadeus token: ${detailedMessage}`);
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
    const url = `${AMADEUS_API_BASE_URL}/v1/reference-data/locations/cities?keyword=${encodeURIComponent(cityName)}&page[limit]=5&sort=analytics.travelers.score`;
    console.log(`SERVER (getCityCode): Fetching city code for "${cityName}" from: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'force-cache', // City codes don't change often
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`SERVER (getCityCode) Amadeus City Lookup Error (Status ${response.status}) for "${cityName}":`, errorBody);
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
                console.log(`SERVER (getCityCode): Found exact city match ${exactMatch.iataCode} for ${cityName}`);
                return exactMatch.iataCode;
             }

             // Fallback: Find first CITY result with an IATA code
             const firstCityMatch = data.data.find(loc => loc.subType === 'CITY' && loc.iataCode);
             if (firstCityMatch && firstCityMatch.iataCode) {
                 console.log(`SERVER (getCityCode): Found fallback city code ${firstCityMatch.iataCode} for ${cityName}`);
                 return firstCityMatch.iataCode;
             }
        }
        console.warn(`SERVER (getCityCode) No usable CITY IATA code found for: ${cityName}`);
        return null;
    } catch (error: any) {
        console.error(`SERVER (getCityCode) Error fetching city code for ${cityName}:`, error);
        return null; // Don't throw, handle gracefully
    }
}

/**
 * Fetches location suggestions from Amadeus based on user input. SERVER ACTION.
 * @param query The user's input string.
 * @returns A promise resolving to an array of LocationSuggestion objects.
 * Returns empty array on error.
 */
export async function suggestLocations(query: string): Promise<LocationSuggestion[]> {
    console.log(`SERVER ACTION: suggestLocations called with query: "${query}"`);
    const startTime = Date.now();

    if (!query || query.trim().length < 2) {
        console.log("SERVER (suggestLocations): Query too short, returning empty.");
        return [];
    }

    // Check API key configuration first
    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
      console.error("SERVER ACTION (suggestLocations): Missing Amadeus API Key/Secret in environment variables.");
      // Don't throw, just return empty array for suggestions
      return [];
    }

    let token: string;
    try {
        token = await getAmadeusAccessToken();
    } catch (error: any) {
        console.error("SERVER ACTION (suggestLocations): Failed to get token:", error.message);
        // Optionally: re-throw a more specific error if needed upstream
        // throw new Error(`Suggestion service unavailable: ${error.message}`);
        return []; // Cannot proceed without token, return empty
    }

    // Use /v1/reference-data/locations?subType=CITY,AIRPORT&keyword=...
    const params = new URLSearchParams();
    params.append('subType', 'CITY'); // Focus on cities for hotel search context
    params.append('keyword', query);
    params.append('page[limit]', '5'); // Limit suggestions
    params.append('sort', 'analytics.travelers.score'); // Sort by relevance/popularity
    params.append('view', 'LIGHT'); // Request less data

    const url = `${AMADEUS_API_BASE_URL}/v1/reference-data/locations?${params.toString()}`;
    console.log(`SERVER (suggestLocations): Fetching from URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store', // Suggestions should be relatively fresh
        });

        const responseBodyText = await response.text(); // Read body once
        const duration = Date.now() - startTime;

        if (!response.ok) {
            console.error(`SERVER (suggestLocations) Amadeus Error (Status ${response.status}, Duration: ${duration}ms):`, responseBodyText);
            // Don't throw from here, return empty to allow graceful UI handling
             // Depending on status, could return a specific message if needed
             // if (response.status === 401) return Promise.reject(new Error("Authentication failed"));
            return [];
        }

        const data: AmadeusLocationApiResponse = JSON.parse(responseBodyText);
        console.log(`SERVER (suggestLocations): Received response (Duration: ${duration}ms). Found ${data?.data?.length || 0} raw locations.`);

        if (data?.data?.length > 0) {
            // Transform the response into our LocationSuggestion format
            const suggestions = data.data
                .filter(loc => loc.subType === 'CITY' && loc.iataCode) // Ensure it's a city with an IATA code
                .map((loc: AmadeusLocation): LocationSuggestion => ({
                    id: loc.iataCode || loc.id, // Prefer IATA code as ID
                    // Handle potentially missing countryCode gracefully
                    name: `${loc.name}${loc.address?.countryCode ? `, ${loc.address.countryCode}` : ''}`, // e.g., "Paris, FR"
                    iataCode: loc.iataCode,
                    subType: loc.subType,
                    address: {
                        cityName: loc.address?.cityName,
                        countryName: loc.address?.countryName,
                        countryCode: loc.address?.countryCode,
                    },
                }));
            console.log(`SERVER (suggestLocations): Filtered to ${suggestions.length} valid suggestions.`);
            return suggestions;
        } else {
            console.log(`SERVER (suggestLocations): No CITY locations with IATA codes found for query "${query}".`);
            return [];
        }

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`SERVER (suggestLocations) Error fetching/processing suggestions for "${query}" (Duration: ${duration}ms):`, error);
        // Avoid throwing to prevent breaking the form, return empty
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
    const startTime = Date.now();

    // --- Criteria Validation ---
    let cityCode = criteria.cityCode; // Use mutable variable for potential lookup

    if (!criteria.checkInDate || !criteria.checkOutDate) {
        console.error("SERVER (searchHotels): Missing check-in or check-out date.");
       throw new Error("Missing required search criteria: Check-in and check-out dates are required.");
   }
    if (!cityCode) {
       // If cityCode is missing, try to derive it from the city name
        if (!criteria.city) {
            console.error("SERVER (searchHotels): Missing city name or city code.");
            throw new Error("Missing required search criteria: City name or City Code is required.");
        }
        console.warn(`SERVER (searchHotels): cityCode missing, attempting lookup for city: ${criteria.city}`);
         let tokenForLookup: string | null = null;
         try {
            tokenForLookup = await getAmadeusAccessToken(); // This will throw if credentials are bad
            cityCode = await getCityCode(criteria.city, tokenForLookup); // Assign lookup result
            if (!cityCode) {
                console.error(`SERVER (searchHotels): Failed lookup for city: ${criteria.city}`);
                throw new Error(`Could not determine location code for city: "${criteria.city}". Please select a valid location from suggestions or check spelling.`);
            }
             console.log(`SERVER (searchHotels): Using derived cityCode ${cityCode} for search.`);
         } catch(lookupError: any){
             console.error("SERVER (searchHotels): Error during token/city lookup:", lookupError);
             // Rethrow with context - this is where the user error likely originated
             throw new Error(`Failed to prepare search: ${lookupError.message}`);
         }
    }

     if (criteria.checkOutDate <= criteria.checkInDate) {
         console.error("SERVER (searchHotels): Invalid date range.");
         throw new Error("Validation Error: Check-out date must be after check-in date.");
     }
    // Basic check for guests
    if (!criteria.numberOfGuests || criteria.numberOfGuests < 1) {
        console.error("SERVER (searchHotels): Invalid number of guests.");
        throw new Error("Validation Error: Number of guests must be at least 1.");
    }

    // --- API Key Check (Redundant here if getAmadeusAccessToken already checks, but good safeguard) ---
    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
        const message = "CRITICAL (Server): Amadeus API Key/Secret are missing in environment. Cannot proceed with search.";
        console.error(message);
        throw new Error("Server configuration error: API credentials missing.");
    }


    let token: string | null = null;

    try {
        // 1. Get Access Token (Might already be cached, or fetched if needed)
        // The check for keys happens within getAmadeusAccessToken now.
        console.log("SERVER (searchHotels): Getting Access Token (may use cache)...");
        token = await getAmadeusAccessToken();
        console.log("SERVER (searchHotels): Access Token available.");

        // 3. Perform Hotel Search using Amadeus V2
        // Format dates correctly (YYYY-MM-DD)
        const checkInFormatted = formatDate(criteria.checkInDate, 'yyyy-MM-dd');
        const checkOutFormatted = formatDate(criteria.checkOutDate, 'yyyy-MM-dd');

        const params = new URLSearchParams();
        params.append('cityCode', cityCode); // V2 requires cityCode (ensured by validation above)
        params.append('checkInDate', checkInFormatted);
        params.append('checkOutDate', checkOutFormatted);
        params.append('adults', criteria.numberOfGuests.toString());
        params.append('roomQuantity', '1'); // Assuming 1 room
        params.append('currency', 'USD');
        params.append('lang', 'EN');
        params.append('paymentPolicy', 'NONE'); // Filter out hotels requiring immediate payment details
        params.append('includeClosed', 'false'); // Exclude permanently closed hotels
        params.append('bestRateOnly', 'true'); // Simplify results
        params.append('view', 'LIGHT'); // Faster response, fewer details
        // Add optional parameters based on Swagger if needed (e.g., ratings, amenities)
        // params.append('ratings', '4,5'); // Example: Filter for 4 and 5 star hotels


        const searchUrl = `${AMADEUS_API_BASE_URL}/v2/shopping/hotel-offers?${params.toString()}`;
        console.log(`SERVER (searchHotels): Attempting to fetch Amadeus V2 Hotel Offers: ${searchUrl}`);

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store', // Don't cache search results
        });

        const responseBodyText = await response.text(); // Read body once
        const duration = Date.now() - startTime;
        console.log(`SERVER (searchHotels): Amadeus V2 Search Response Status: ${response.status} (Duration: ${duration}ms)`);


        if (!response.ok) {
            console.error(`SERVER (searchHotels) Amadeus V2 Search Error (Status ${response.status}):`, responseBodyText);
            let apiErrorMessage = `Amadeus v2 hotel search failed: ${response.status} ${response.statusText}`;
            let errorCode: string | number = response.status;
             try {
                 const errorJson = JSON.parse(responseBodyText);
                 if (errorJson.errors && errorJson.errors.length > 0) {
                   const firstError = errorJson.errors[0];
                   errorCode = firstError.code || errorCode;
                   apiErrorMessage = `Search failed: ${firstError.title || 'Unknown API Error'}. ${firstError.detail || ''} (Code: ${errorCode})`;

                   // Refine messages based on common error codes
                   if ([38196, 477, 574, 904].includes(Number(errorCode))) {
                       // More specific message for "no availability" or date issues
                       apiErrorMessage = `No hotels found for ${criteria.cityCode || criteria.city} for the selected dates (${checkInFormatted} to ${checkOutFormatted}). This could be due to no availability or invalid dates/parameters. Please adjust your search. (Code: ${errorCode})`;
                   } else if (firstError.status === 400 || errorCode === 4926) {
                       apiErrorMessage = `Search request invalid. Please check the location, dates, and guest count. (Code: ${errorCode})`;
                   } else if (firstError.status === 401) {
                       apiErrorMessage = `Authentication failed with hotel service. Please contact support if this persists. (Code: ${errorCode})`;
                   } else if (firstError.status === 403) {
                       apiErrorMessage = `Permission denied by hotel service. Please contact support. (Code: ${errorCode})`;
                   } else if (firstError.status >= 500) {
                       apiErrorMessage = `Hotel service temporary error (${response.status}). Please try again later. (Code: ${errorCode})`;
                   }
                 }
             } catch (parseError) {
                 // If error response is not JSON, use the status text but add context
                 apiErrorMessage = `Hotel service communication error (${response.status} ${response.statusText}). Please try again later.`;
              }
            throw new Error(apiErrorMessage);
        }

        const data = JSON.parse(responseBodyText);

        if (data?.data?.length > 0) {
             const validOffers = data.data.filter((offer: AmadeusHotelOffer) =>
                offer.hotel && offer.hotel.hotelId && offer.hotel.name &&
                offer.available && offer.offers?.[0]?.price?.total // Ensure core data exists
             );
             console.log(`SERVER (searchHotels): Found ${data.data.length} offers (v2), ${validOffers.length} seem valid and available.`);

             if (validOffers.length > 0) {
                 // Limit results for performance if needed
                 const limitedResults = validOffers.slice(0, 20); // Example: limit to 20
                 console.log(`SERVER (searchHotels): Transforming ${limitedResults.length} valid offers.`);
                 return Promise.all(limitedResults.map(transformAmadeusHotelOffer));
             } else {
                 console.log("SERVER (searchHotels): No valid/available offers found after filtering.");
                  // Throw a specific error if filtering removed all results but the API call was successful
                  throw new Error(`While offers were found for ${cityCode}, none met the availability or data requirements after filtering. Try adjusting dates or criteria.`);
             }
        } else {
            console.log("SERVER (searchHotels): No hotel data array found in v2 response (API reported success but no data).");
            // This scenario implies the API call worked (status 200) but returned an empty data array.
            // Treat this similar to the 38196 error code scenario.
            throw new Error(`No hotels found for ${criteria.cityCode || criteria.city} for the selected dates (${checkInFormatted} to ${checkOutFormatted}). Please try different dates or another location.`);
        }

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error("-----------------------------------------");
        console.error("SERVER (searchHotels) Error during Amadeus v2 hotel search process:");
        console.error(`Timestamp: ${new Date().toISOString()} (Duration: ${duration}ms)`);
        if (token) console.error("Token used: YES (obtained successfully)"); else console.error("Token used: NO (failed to obtain or not reached)");
        if (cityCode) console.error(`City Code used: ${cityCode}`); else console.error(`City Code used: NO (not provided or lookup failed). Searched city name: "${criteria.city}"`);
        console.error("Search Criteria (resolved):", { ...criteria, cityCode, checkInDate: formatDate(criteria.checkInDate, 'yyyy-MM-dd'), checkOutDate: formatDate(criteria.checkOutDate, 'yyyy-MM-dd') });
        console.error("Error Caught:", error.name, error.message);
        // console.error("Error Stack:", error.stack); // Can be very verbose
        console.error("-----------------------------------------");

        // Determine the user-facing message based on the error caught
        let userMessage = "An unexpected error occurred during the hotel search.";
         // Prioritize the configuration error message if it's the root cause
        if (error.message.includes("Server configuration error:") || error.message.includes("Failed to prepare search: Server configuration error:")) {
            userMessage = "Server configuration error: API credentials missing or invalid. Please contact support.";
        } else if (error.message.includes("Failed to get Amadeus token:") || error.message.includes("Amadeus auth failed")) {
             userMessage = `Authentication with the hotel service failed.${error.message.includes('Invalid Credentials') ? ' Check server API credentials.' : ' Please contact support if this persists.'}`;
        } else if (error.message.includes("Search failed:") || // Specific parsed API errors
                   error.message.includes("No hotels found") ||
                   error.message.includes("request invalid") ||
                   error.message.includes("service temporary error") ||
                   error.message.includes("service communication error") ||
                   error.message.includes("none met the availability")) {
             userMessage = error.message; // Use the already refined message
        } else if (error.message.includes("Could not determine location code") || error.message.includes("Failed to prepare search")) {
             userMessage = error.message; // Error during city code lookup
        } else if (error.message.includes("Validation Error:")) {
             userMessage = error.message; // Input validation error
        } else if (error.message.includes('fetch') || error.message.includes('NetworkError')) { // More robust check for network issues
             userMessage = "Network error: Could not reach the hotel search service. Please check your connection or try again later.";
        }
        // Propagate the refined error message
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
    // Basic validation simulation
    paymentValid = !!paymentDetails.cardNumber && /^\d{16}$/.test(paymentDetails.cardNumber) && // Ensure 16 digits
                   !!paymentDetails.expiryDate && /^(0[1-9]|1[0-2])\/\d{2}$/.test(paymentDetails.expiryDate) &&
                   !!paymentDetails.cvc && /^\d{3,4}$/.test(paymentDetails.cvc);
  } else if (paymentDetails.method === 'paypal') {
    paymentValid = !!paymentDetails.paypalEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentDetails.paypalEmail);
  }

  if (!paymentValid) {
     console.error("SERVER ACTION: Simulated payment validation failed.");
    throw new Error("Simulated payment validation failed. Please check payment details.");
  }

  // In a real scenario, price might need re-confirmation via Amadeus Pricing API
  // For simulation, we use the price from the search results.
  const totalPrice = hotel.pricePerNight; // Assuming pricePerNight holds the total offer price from search

  const newTrip: Trip = {
    // Use a more robust unique ID generation if possible
    id: `trip-amadeus-server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hotel,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice: totalPrice,
    status: 'upcoming', // Default status for new booking
  };

  console.log("SERVER ACTION: Booking successful (simulated):", newTrip.id);
  return newTrip;
}


// --- Local Storage Trip Management (Client-Side Functions) ---
// NOTE: These functions run ONLY in the browser. They are marked async
//       for consistency but don't perform network requests themselves.

/**
 * Retrieves all trips from localStorage. Client-side only.
 */
export async function getTrips(): Promise<Trip[]> {
  if (typeof window === 'undefined') {
     console.warn("CLIENT getTrips: Called outside browser, returning empty array.");
     return [];
   }
  try {
    const tripsJson = localStorage.getItem('ecoTrips');
    if (tripsJson) {
      const parsedTrips: any[] = JSON.parse(tripsJson);
       // Robust parsing with date/hotel validation
      return parsedTrips.map(trip => ({
        ...trip,
        // Ensure dates are Date objects
        checkInDate: trip.checkInDate ? new Date(trip.checkInDate) : new Date(), // Default to now if invalid
        checkOutDate: trip.checkOutDate ? new Date(trip.checkOutDate): new Date(), // Default to now if invalid
        hotel: trip.hotel || null, // Ensure hotel object exists
      })).filter(trip =>
          trip.hotel && trip.hotel.id && trip.checkInDate && trip.checkOutDate && // Ensure essential data exists
          !isNaN(trip.checkInDate.getTime()) && !isNaN(trip.checkOutDate.getTime()) && // Validate dates
          trip.checkOutDate > trip.checkInDate // Ensure checkout is after checkin
      ) as Trip[];
    }
  } catch (error) {
    console.error("CLIENT: Failed to parse trips from localStorage:", error);
    localStorage.removeItem('ecoTrips'); // Clear potentially corrupt data
  }
  return [];
}

/**
 * Adds a new trip to localStorage. Client-side only.
 */
export async function addTrip(trip: Trip): Promise<void> {
   if (typeof window === 'undefined') {
     console.warn("CLIENT addTrip: Called outside browser, operation skipped.");
     return;
   }
    try {
        const existingTrips = await getTrips();
        // Prevent adding duplicates (simple check by ID)
        if (existingTrips.some(t => t.id === trip.id)) {
            console.warn(`CLIENT addTrip: Trip with ID ${trip.id} already exists.`);
            return;
        }
        const updatedTrips = [...existingTrips, trip];
        localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
        console.log("CLIENT: Trip added to localStorage:", trip.id);
    } catch (error) {
        console.error("CLIENT: Failed to save trip to localStorage:", error);
         // Optional: Notify user of storage issue
    }
}

/**
 * Removes a trip from localStorage by ID. Client-side only.
 */
export async function removeTrip(tripId: string): Promise<void> {
  if (typeof window === 'undefined') {
      console.warn("CLIENT removeTrip: Called outside browser, operation skipped.");
      return;
    }
    try {
      let existingTrips = await getTrips();
      const updatedTrips = existingTrips.filter(trip => trip.id !== tripId);
      // Check if a trip was actually removed
      if (existingTrips.length !== updatedTrips.length) {
          localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
          console.log("CLIENT: Trip removed from localStorage:", tripId);
      } else {
           console.warn("CLIENT removeTrip: Trip not found with ID:", tripId);
      }
    } catch (error) {
      console.error("CLIENT: Failed to remove trip from localStorage:", error);
    }
}

/**
 * Updates a trip in localStorage (e.g., changing status). Client-side only.
 */
export async function updateTrip(updatedTrip: Trip): Promise<void> {
  if (typeof window === 'undefined') {
     console.warn("CLIENT updateTrip: Called outside browser, operation skipped.");
     return;
   }
    try {
      let existingTrips = await getTrips();
      let found = false;
      const updatedTrips = existingTrips.map(trip => {
          if (trip.id === updatedTrip.id) {
              found = true;
              // Ensure dates are still Date objects before stringifying
              return {
                  ...updatedTrip,
                  checkInDate: updatedTrip.checkInDate instanceof Date ? updatedTrip.checkInDate : new Date(updatedTrip.checkInDate),
                  checkOutDate: updatedTrip.checkOutDate instanceof Date ? updatedTrip.checkOutDate : new Date(updatedTrip.checkOutDate),
              };
          }
          return trip;
      });

      if (found) {
          localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
          console.log("CLIENT: Trip updated in localStorage:", updatedTrip.id);
      } else {
          console.warn("CLIENT updateTrip: Trip not found with ID:", updatedTrip.id);
      }
    } catch (error) {
      console.error("CLIENT: Failed to update trip in localStorage:", error);
    }
}
