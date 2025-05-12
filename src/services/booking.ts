
'use server';

import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails, AmadeusHotelOffer, AmadeusAccessToken } from '@/types';

// --- Amadeus API Configuration ---
// Hardcoded credentials as requested by the user.
// WARNING: Hardcoding sensitive credentials directly in the source code is NOT recommended for production environments.
//          It's better to use environment variables or a secure secrets management solution.
const AMADEUS_API_KEY = 'jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9';
const AMADEUS_API_SECRET = 'U1MGYukFmZhrjq40';
const AMADEUS_API_BASE_URL = 'https://test.api.amadeus.com'; // Use https://api.amadeus.com for production

// --- Amadeus Authentication ---
let accessToken: AmadeusAccessToken | null = null;
let tokenExpiryTime: number | null = null;

/**
 * Fetches or retrieves a cached Amadeus API access token.
 * Server-side only.
 * @returns A promise that resolves to the access token string.
 * @throws Error if authentication fails or API keys are missing/invalid.
 */
async function getAmadeusAccessToken(): Promise<string> {
  const now = Date.now();

  if (accessToken && tokenExpiryTime && now < tokenExpiryTime) {
    // console.log("Using cached Amadeus token (Server)");
    return accessToken.access_token;
  }

  // Removed the check for missing keys from environment variables as they are now hardcoded
  console.log("Fetching new Amadeus token (Server)...");
  try {
    const response = await fetch(`${AMADEUS_API_BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Use the hardcoded keys
      body: `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`,
      // Important for server-side fetches if caching interferes
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Amadeus Auth Error Response Body (Server):", errorBody); // Log the raw error body

      let errorMessage = `Amadeus auth failed: ${response.status} ${response.statusText}`;
       // Try to parse for more specific feedback, especially "invalid_client"
      try {
         const errorJson = JSON.parse(errorBody);
         if (errorJson.error === 'invalid_client') {
            errorMessage = `Amadeus auth failed: Invalid API Key or Secret. Please verify the hardcoded credentials. (Code: ${errorJson.code || 'N/A'})`;
            console.error(">>> Specific Error: Invalid Amadeus Client Credentials (Server) <<<");
         } else if (errorJson.title) {
             errorMessage = `Amadeus auth failed: ${errorJson.title} (Code: ${errorJson.code || 'N/A'})`;
         }
      } catch (parseError) {
        // Ignore parsing error, use the generic message
        console.warn("Could not parse Amadeus auth error response JSON (Server).");
      }
       console.error(`AMADEUS_AUTH_FAILED (Server): ${errorMessage}`);
      throw new Error(errorMessage); // Throw the detailed error message
    }

    const tokenData: AmadeusAccessToken = await response.json();
    accessToken = tokenData;
    // Set expiry time slightly earlier than actual expiry to be safe (e.g., 5 minutes buffer)
    tokenExpiryTime = now + (tokenData.expires_in - 300) * 1000;
    console.log("New Amadeus token obtained (Server).");
    return accessToken.access_token;
  } catch (error: any) {
    console.error("Error fetching Amadeus access token (Server):", error);
    accessToken = null; // Invalidate token on error
    tokenExpiryTime = null;
    // Re-throw the caught error (could be network error or the specific auth error)
    // Append context that it happened server-side
    throw new Error(`Failed to get Amadeus token (Server): ${error.message}`);
  }
}


// --- Helper Functions ---

/**
 * Gets the IATA city code for a given city name using Amadeus API.
 * Server-side only.
 * @param cityName The name of the city.
 * @param token The Amadeus access token.
 * @returns A promise resolving to the city code string or null if not found.
 */
async function getCityCode(cityName: string, token: string): Promise<string | null> {
  try {
    console.log(`Fetching city code for: ${cityName} (Server)`);
    const url = `${AMADEUS_API_BASE_URL}/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(cityName)}`;
    console.log(`Amadeus City Lookup URL: ${url}`); // Log the URL being fetched

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
       cache: 'no-store', // Avoid caching issues for dynamic data
    });

    if (!response.ok) {
       const errorBody = await response.text();
       console.error(`Amadeus City Lookup Error Response (Server, Status ${response.status}):`, errorBody);
       // Try to parse the error for more specific feedback
       try {
         const errorJson = JSON.parse(errorBody);
         if (errorJson.errors && errorJson.errors.length > 0) {
           const firstError = errorJson.errors[0];
           console.error(`Parsed Amadeus City Lookup API Error (Server, ${firstError.status}): ${firstError.title} - ${firstError.detail || firstError.code}`);
           // Don't throw here, just log and return null
         }
       } catch (parseError) {
          console.warn("Could not parse Amadeus city lookup error response JSON (Server).");
       }
      console.error(`AMADEUS_CITY_LOOKUP_FAILED (Server): ${response.status} ${response.statusText} for city "${cityName}"`);
      return null; // Indicate failure to find code
    }

    const data = await response.json();
    // console.log("Amadeus City Lookup Raw Response Data:", JSON.stringify(data, null, 2)); // Log raw response data

    if (data && data.data && data.data.length > 0) {
      // Prioritize exact matches or cities over airports if possible
      const exactCityMatch = data.data.find((loc: any) =>
          loc.name?.toLowerCase() === cityName.toLowerCase() && loc.subType === 'CITY'
      );
       if (exactCityMatch && exactCityMatch.iataCode) {
          console.log(`Found exact city match code for ${cityName}: ${exactCityMatch.iataCode} (Server)`);
          return exactCityMatch.iataCode;
      }
      // Fallback: Find the first result that is a CITY and has an iataCode
      const firstCityMatch = data.data.find((loc: any) => loc.subType === 'CITY' && loc.iataCode);
      if (firstCityMatch) {
          console.log(`Found fallback city code for ${cityName}: ${firstCityMatch.iataCode} (from ${firstCityMatch.name}) (Server)`);
          return firstCityMatch.iataCode;
      }
       // Fallback 2: Use the very first result if it has an IATA code, regardless of subtype (less ideal)
       if (data.data[0].iataCode) {
            console.warn(`Using first result IATA code (${data.data[0].iataCode} for ${data.data[0].name}) as city code fallback for ${cityName} (Server)`);
            return data.data[0].iataCode;
       }

       console.warn(`No suitable IATA code found for city: ${cityName} in Amadeus response (Server)`);
      return null;
    } else {
      console.warn(`No city code data found for: ${cityName} in Amadeus response (Server)`);
      return null;
    }
  } catch (error: any) {
    console.error(`Error fetching city code for ${cityName} (Server):`, error);
    return null;
  }
}


/**
 * Transforms an Amadeus hotel offer into our application's Hotel type.
 * Can run on server or client, but typically called server-side after fetch.
 * @param offer The hotel offer object from Amadeus API.
 * @returns A Hotel object.
 */
function transformAmadeusHotelOffer(offer: AmadeusHotelOffer): Hotel {
  const hotelData = offer.hotel;
  const offerDetails = offer.offers?.[0]; // Get the first offer
  const offerPrice = offerDetails?.price;

  // Placeholder image logic - Amadeus Hotel Offers API may not provide images directly.
  // You might need another API call (e.g., Hotel Details) or use a generic image.
  const imageUrl = hotelData.media?.[0]?.uri || `https://picsum.photos/seed/${hotelData.hotelId || Math.random()}/400/300`;

  // Address construction - might need refinement based on actual API response structure
  const addressParts = [hotelData.address?.lines?.[0], hotelData.address?.cityName, hotelData.address?.postalCode, hotelData.address?.countryCode];
  const address = addressParts.filter(Boolean).join(', ');

  // Rating - Amadeus might use 'rating' (e.g., 4 for 4-star) or have it nested differently. Adapt as needed.
  // Assuming hotel.rating is a number from 1 to 5 here.
  const rating = hotelData.rating ? parseInt(hotelData.rating, 10) : 0; // Example: Convert star string to number

  // Amenities - Hotel Offers usually has limited amenities. Full list requires Hotel Details API.
  // We'll use a placeholder or basic info if available.
   const amenities = hotelData.amenities || []; // Example: If 'amenities' array exists directly

  // Extract description from the *offer* if available, otherwise fallback to hotel
   const roomDescription = offerDetails?.room?.description?.text;
   const hotelDescription = hotelData.description?.text;
   const description = roomDescription || hotelDescription || `Eco-friendly stay at ${hotelData.name || 'this hotel'} in ${hotelData.address?.cityName || 'the city'}. Check availability for details.`;


  return {
    id: hotelData.hotelId || `unknown-${Math.random()}`,
    name: hotelData.name || 'Hotel Name Unavailable',
    address: address || 'Address Unavailable',
    city: hotelData.address?.cityName || 'City Unavailable',
    // Price might be per stay, adjust logic if needed. Safely parse float.
    pricePerNight: offerPrice?.total ? parseFloat(offerPrice.total) : 0,
    imageUrl: imageUrl,
    // Use rating if valid (1-5), else provide a random fallback or 0/null
    rating: rating > 0 && rating <= 5 ? rating : (Math.random() * 1.5 + 3).toFixed(1), // Random 3.0-4.5 fallback
    amenities: amenities.slice(0, 6), // Limit displayed amenities
    latitude: hotelData.latitude,
    longitude: hotelData.longitude,
    description: description, // Use combined description
    currency: offerPrice?.currency || 'USD',
  };
}


// --- API Functions ---

/**
 * Searches for hotels using the Amadeus API. Runs Server-Side.
 * @param criteria The search criteria.
 * @returns A promise that resolves to an array of Hotel objects.
 * @throws Error if search fails due to configuration, authentication, or API errors.
 */
export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
  console.log("Initiating Amadeus hotel search (Server)...");
  console.log("Search Criteria Received:", JSON.stringify(criteria, null, 2));

  const { city, checkInDate, checkOutDate, numberOfGuests } = criteria;

  // --- Server-Side Validation ---
  if (!city) {
    console.warn("SERVER_VALIDATION_FAILED: No city provided.");
    throw new Error("Please provide a destination city for the search.");
  }
  if (!checkInDate || !checkOutDate) {
      console.warn("SERVER_VALIDATION_FAILED: Check-in and/or Check-out date missing.");
      throw new Error("Please provide both check-in and check-out dates for the search.");
  }
  // Ensure dates are valid Date objects before comparing
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      console.warn("SERVER_VALIDATION_FAILED: Invalid date format received.");
      throw new Error("Invalid date format provided. Please select dates from the calendar.");
  }
   if (checkOut <= checkIn) {
      console.warn("SERVER_VALIDATION_FAILED: Check-out date must be after check-in date.");
      throw new Error("Check-out date must be after check-in date.");
  }
   if (numberOfGuests < 1) {
      console.warn("SERVER_VALIDATION_FAILED: Number of guests less than 1.");
      throw new Error("Please specify at least one guest.");
  }
    // Basic check for dates too far in the past (allowing today)
   const today = new Date();
   today.setHours(0, 0, 0, 0); // Compare date part only
   if (checkIn < today) {
     console.warn("SERVER_VALIDATION_FAILED: Check-in date is in the past.");
     throw new Error("Check-in date cannot be in the past.");
   }
   // --- End Server-Side Validation ---


  // Removed check for missing API keys from environment variables

  let token: string | null = null;
  let cityCode: string | null = null;
  let response: Response | null = null; // Declare response here to access in catch
  let searchUrl = `${AMADEUS_API_BASE_URL}/v2/shopping/hotel-offers`;
  let params: URLSearchParams | null = null; // Declare params here to access in catch
  let fullSearchUrl = ''; // Declare here to access in catch


  try {
    // Get token - This will throw if auth fails (e.g., bad keys, network issues)
    token = await getAmadeusAccessToken();
    console.log("Amadeus token obtained successfully (Server).");

    // Get City Code
    cityCode = await getCityCode(city, token);
    if (!cityCode) {
      console.warn(`Could not find IATA city code for ${city}. Cannot search Amadeus. (Server)`);
      throw new Error(`Could not find location code for "${city}". Please try a different city name or spelling.`);
    }
    console.log(`Using city code: ${cityCode} for ${city} (Server).`);

    // Prepare Search Parameters
    const checkInFormatted = checkIn.toISOString().split('T')[0];
    const checkOutFormatted = checkOut.toISOString().split('T')[0];

    params = new URLSearchParams({
      cityCode: cityCode,
      checkInDate: checkInFormatted,
      checkOutDate: checkOutFormatted,
      adults: numberOfGuests.toString(),
      currency: 'USD',
      radius: '20', // Search radius in KM
      radiusUnit: 'KM',
      view: 'LIGHT', // Use 'FULL' for more details if needed (might increase cost/latency)
      bestRateOnly: 'true', // Typically recommended
      // Consider adding sort: 'PRICE' or 'DISTANCE' if needed
    });

    fullSearchUrl = `${searchUrl}?${params.toString()}`;
    console.log(`Attempting Amadeus Search (Server): GET ${fullSearchUrl}`);
    console.log(`  Parameters: cityCode=${cityCode}, checkIn=${checkInFormatted}, checkOut=${checkOutFormatted}, adults=${numberOfGuests}`);


    // Perform Hotel Search
    response = await fetch(fullSearchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store', // Ensure fresh data for search results
    });

    console.log(`Amadeus Search Response Status: ${response.status} ${response.statusText} (Server)`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Amadeus Hotel Search Error Response Body (Server, Status ${response.status}):`, errorBody);
       // Try to parse the error for more specific feedback
       let apiErrorMessage = `Amadeus hotel search failed: ${response.status} ${response.statusText}`;
       try {
         const errorJson = JSON.parse(errorBody);
         if (errorJson.errors && errorJson.errors.length > 0) {
           const firstError = errorJson.errors[0];
           const errorCode = firstError.code || 'N/A';
           const errorTitle = firstError.title || 'Unknown Error';
           const errorDetail = firstError.detail || 'No details provided.';
           console.error(`Parsed Amadeus API Error (Server, Status ${firstError.status}): Code=${errorCode}, Title=${errorTitle}, Detail=${errorDetail}`);

           // Customize message based on common error codes if desired
           if (errorCode === 38196 || errorCode === '38196') { // Invalid date format or range
                apiErrorMessage = `Search failed: ${errorTitle}. Please check your dates. (${errorCode})`;
           } else if (errorCode === 38191 || errorCode === '38191') { // Mandatory parameter missing
                apiErrorMessage = `Search failed: Missing required information (${errorTitle}). (${errorCode})`;
           } else if (response.status === 404 || errorTitle.toLowerCase().includes('not found') || errorCode === 477 || errorCode === '477') {
                apiErrorMessage = `Search failed: ${errorTitle}. Please check your dates or destination. (${errorCode})`;
           } else {
                apiErrorMessage = `Search failed: ${errorTitle} (${errorCode})`;
           }
         }
       } catch (parseError) {
          console.warn("Could not parse Amadeus search error response JSON (Server). The raw error body was logged above.");
       }
       console.error(`AMADEUS_SEARCH_FAILED (Server): ${apiErrorMessage}`);
      throw new Error(apiErrorMessage); // Throw the specific API error
    }

    // Process Successful Response
    const data = await response.json();
    // console.log("Amadeus Search Raw Success Response Data:", JSON.stringify(data, null, 2)); // Optional: Log raw success data for debugging structure

    if (data && data.data && Array.isArray(data.data)) {
       console.log(`Found ${data.data.length} hotel offers from Amadeus (Server).`);
       // Filter out offers that might be missing essential info like price or hotel details
       const validOffers = data.data.filter((offer: AmadeusHotelOffer) => offer.hotel && offer.offers?.[0]?.price?.total);
        if (validOffers.length < data.data.length) {
            console.warn(`Filtered out ${data.data.length - validOffers.length} offers due to missing hotel or price information (Server).`);
        }
        if (validOffers.length === 0) {
             console.log("Amadeus search returned results, but none had valid hotel and price info after filtering (Server).");
             // No need to throw, just return empty. The UI will handle 'No Results'.
        }
       return validOffers.map(transformAmadeusHotelOffer);
    } else {
      console.warn("No 'data' array found in Amadeus API response or unexpected format (Server):", data);
      return []; // Return empty array for no results or bad format
    }

  } catch (error: any) {
    // Log the detailed error server-side
    console.error("-----------------------------------------");
    console.error("Error during Amadeus hotel search process (Server):");
    console.error(`Timestamp: ${new Date().toISOString()}`);
    console.error(`Search Criteria: ${JSON.stringify(criteria)}`);
    console.error(`Attempted URL: ${fullSearchUrl || 'URL not constructed'}`); // Log the URL if available
    if (token) console.error("Token used: YES (obtained successfully)"); else console.error("Token used: NO (failed to obtain or not reached)");
    if (cityCode) console.error(`City Code Resolved: ${cityCode}`); else console.error("City Code Resolved: NO");
    if (params) console.error(`Search Params Sent: ${params.toString()}`); else console.error("Search Params Sent: Not generated");
    if (response) {
      console.error(`Fetch Status Code: ${response.status}`);
      console.error(`Fetch Status Text: ${response.statusText}`);
    } else {
       console.error("Fetch Status: Request likely failed before receiving a response (e.g., network error, DNS, CORS issue if client-side)");
    }
    console.error("Caught Error Type:", error?.constructor?.name);
    console.error("Caught Error Message:", error.message);
    // Don't log full stack trace to client console, but keep it server-side
    console.error("Caught Error Stack:", error.stack);
    console.error("-----------------------------------------");

    // Craft a more user-friendly message to send back to the client
    let userMessage = "An unexpected error occurred during the hotel search. Please try again later.";
    if (error.message?.includes("Failed to fetch")) {
        userMessage = "Could not connect to the hotel search service. Please check your internet connection and try again.";
    } else if (error.message?.includes("Invalid API Key or Secret")) {
        // Don't expose key details to client, provide generic config error
        userMessage = "There's an issue with the connection to the hotel provider. Please contact support if the problem persists.";
    } else if (error.message?.includes("Could not find location code")) {
        userMessage = error.message; // Pass the specific city error through
    } else if (error.message?.includes("check your dates")) {
         userMessage = error.message; // Pass the specific date error through
    } else if (error.message?.includes("check your dates or destination")) { // Catch the refined message
         userMessage = error.message;
    } else if (error.message?.includes("Missing required information")) {
         userMessage = error.message; // Pass specific missing info error through
    } else if (error.message?.includes("API credentials missing")) {
        // Generic message for config issues detected early
         userMessage = "Hotel search is temporarily unavailable due to a configuration issue. Please try again later.";
    }
    // Use the specific API error message if it doesn't match known patterns
    else if (error.message?.startsWith("Search failed:")) {
        userMessage = error.message;
    }


    // Propagate a new error with the user-friendly message
    throw new Error(userMessage);
  }
}

/**
 * Simulates booking a hotel. Runs Server-Side.
 * This function would interact with Amadeus's booking APIs in a real app.
 * For now, it remains a simulation, creating a local trip record.
 */
export async function simulateBookHotel(
  hotel: Hotel,
  checkInDate: Date,
  checkOutDate: Date,
  numberOfGuests: number,
  paymentDetails: PaymentDetails // Payment details aren't used in simulation but kept for structure
): Promise<Trip> {
  console.log("Simulating Amadeus booking (Server) for hotel:", hotel.name, "with ID:", hotel.id);
  console.log("Payment method (simulated):", paymentDetails.method);

  // TODO: In a real application, this would involve SERVER-SIDE calls to:
  // 1. Re-fetching the specific offer price (Hotel Offers Pricing API: /v1/shopping/hotel-offers/pricing)
  //    Requires the `offerId` from the search results (needs to be added to transformAmadeusHotelOffer and Hotel type).
  // 2. Creating the booking (Hotel Booking API: /v1/booking/hotel-bookings)
  //    This requires handling traveler information, payment details (securely!), and API responses.

  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay for booking

  // Calculate total price. NOTE: The `hotel.pricePerNight` from the search result
  // often represents the TOTAL price for the stay duration searched.
  // Verify this based on Amadeus API docs for `/v2/shopping/hotel-offers`.
  // Assuming pricePerNight IS the total price for the stay:
  const totalPrice = hotel.pricePerNight;

  // If pricePerNight was confirmed to be *per night*:
  // const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
  // const totalPrice = hotel.pricePerNight * nights;

  const newTrip: Trip = {
    id: `trip-amadeus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hotel,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice: totalPrice, // Use calculated or direct total price
    status: 'upcoming', // Status after successful simulated booking
  };

  console.log("Amadeus Booking successful (simulated, Server):", newTrip);
  // IMPORTANT: Since addTrip uses localStorage, it MUST be called client-side.
  // This simulated booking function returns the Trip, and the caller (client-side)
  // should then call addTrip.
  return newTrip;
}


// --- Local Storage Trip Management ---
// These functions interact with localStorage and MUST run client-side.
// They are NOT marked with 'use server'.

/**
 * Retrieves all trips from localStorage. Client-side only.
 */
export async function getTrips(): Promise<Trip[]> {
  // Ensure this runs only on the client-side
  if (typeof window === 'undefined') {
    console.warn("Attempted to call getTrips (localStorage) on the server.");
    return [];
  }
  try {
    const tripsJson = localStorage.getItem('ecoTrips');
    if (tripsJson) {
      const parsedTrips: any[] = JSON.parse(tripsJson);
      // Validate and parse dates properly
      return parsedTrips.map(trip => ({
        ...trip,
        // Ensure dates are parsed back into Date objects
        checkInDate: trip.checkInDate ? new Date(trip.checkInDate) : new Date(),
        checkOutDate: trip.checkOutDate ? new Date(trip.checkOutDate): new Date(),
        // Ensure hotel object structure is maintained (it should be if saved correctly)
        hotel: trip.hotel || {}, // Basic check for hotel object
      })).filter(trip => trip.hotel && trip.hotel.id && !isNaN(trip.checkInDate.getTime()) && !isNaN(trip.checkOutDate.getTime())); // Filter out trips missing hotel ID or invalid dates
    }
  } catch (error) {
    console.error("Failed to parse trips from localStorage:", error);
    localStorage.removeItem('ecoTrips'); // Clear corrupted data
  }
  return [];
}

/**
 * Adds a new trip to localStorage. Client-side only.
 */
export async function addTrip(trip: Trip): Promise<void> {
   // Ensure this runs only on the client-side
  if (typeof window === 'undefined') {
    console.warn("Attempted to call addTrip (localStorage) on the server.");
    return;
  }
    try {
        const existingTrips = await getTrips(); // getTrips is client-side safe
        const updatedTrips = [...existingTrips, trip];
        localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
        console.error("Failed to save trip to localStorage:", error);
        // Consider adding user feedback here (e.g., toast notification)
    }

}

/**
 * Removes a trip from localStorage by ID. Client-side only.
 */
export async function removeTrip(tripId: string): Promise<void> {
  // Ensure this runs only on the client-side
  if (typeof window === 'undefined') {
     console.warn("Attempted to call removeTrip (localStorage) on the server.");
    return;
  }
    try {
      let existingTrips = await getTrips(); // client-side safe
      const updatedTrips = existingTrips.filter(trip => trip.id !== tripId);
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
      console.error("Failed to remove trip from localStorage:", error);
      // Consider user feedback
    }

}

/**
 * Updates a trip in localStorage (e.g., changing status). Client-side only.
 */
export async function updateTrip(updatedTrip: Trip): Promise<void> {
  // Ensure this runs only on the client-side
 if (typeof window === 'undefined') {
     console.warn("Attempted to call updateTrip (localStorage) on the server.");
    return;
  }
    try {
      let existingTrips = await getTrips(); // client-side safe
      const updatedTrips = existingTrips.map(trip =>
        trip.id === updatedTrip.id ? updatedTrip : trip
      );
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
      console.error("Failed to update trip in localStorage:", error);
      // Consider user feedback
    }

}
