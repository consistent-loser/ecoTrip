

import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails, AmadeusHotelOffer, AmadeusAccessToken } from '@/types';

// --- Amadeus API Configuration ---
// Environment variables are loaded automatically by Next.js from .env.local
const AMADEUS_API_KEY = process.env.NEXT_PUBLIC_AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.NEXT_PUBLIC_AMADEUS_API_SECRET;
const AMADEUS_API_BASE_URL = 'https://test.api.amadeus.com'; // Use https://api.amadeus.com for production

// --- Amadeus Authentication ---
let accessToken: AmadeusAccessToken | null = null;
let tokenExpiryTime: number | null = null;

/**
 * Fetches or retrieves a cached Amadeus API access token.
 * @returns A promise that resolves to the access token string.
 * @throws Error if authentication fails or API keys are missing/invalid.
 */
async function getAmadeusAccessToken(): Promise<string> {
  const now = Date.now();

  if (accessToken && tokenExpiryTime && now < tokenExpiryTime) {
    // console.log("Using cached Amadeus token");
    return accessToken.access_token;
  }

  // Explicitly check if keys are missing *before* making the API call
  if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
      const message = "Amadeus API Key/Secret not configured. Cannot authenticate. Please set NEXT_PUBLIC_AMADEUS_API_KEY and NEXT_PUBLIC_AMADEUS_API_SECRET environment variables.";
      console.error(message);
      throw new Error(message); // Throw error early
  }
  // Optional: Check for known placeholder values if you want to be extra cautious
  // (Though the check above should generally cover missing real keys)
  // if (AMADEUS_API_KEY === 'YOUR_PLACEHOLDER_KEY' || AMADEUS_API_SECRET === 'YOUR_PLACEHOLDER_SECRET') { ... }


  console.log("Fetching new Amadeus token...");
  try {
    const response = await fetch(`${AMADEUS_API_BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Use the keys fetched from environment variables
      body: `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Amadeus Auth Error Response Body:", errorBody); // Log the raw error body

      let errorMessage = `Amadeus auth failed: ${response.status} ${response.statusText}`;
       // Try to parse for more specific feedback, especially "invalid_client"
      try {
         const errorJson = JSON.parse(errorBody);
         if (errorJson.error === 'invalid_client') {
            errorMessage = `Amadeus auth failed: Invalid API Key or Secret. Please verify your credentials in environment variables. (Code: ${errorJson.code || 'N/A'})`;
            console.error(">>> Specific Error: Invalid Amadeus Client Credentials <<<");
         } else if (errorJson.title) {
             errorMessage = `Amadeus auth failed: ${errorJson.title} (Code: ${errorJson.code || 'N/A'})`;
         }
      } catch (parseError) {
        // Ignore parsing error, use the generic message
        console.warn("Could not parse Amadeus auth error response JSON.");
      }

      throw new Error(errorMessage); // Throw the detailed error message
    }

    const tokenData: AmadeusAccessToken = await response.json();
    accessToken = tokenData;
    // Set expiry time slightly earlier than actual expiry to be safe (e.g., 5 minutes buffer)
    tokenExpiryTime = now + (tokenData.expires_in - 300) * 1000;
    console.log("New Amadeus token obtained.");
    return accessToken.access_token;
  } catch (error) {
    console.error("Error fetching Amadeus access token:", error);
    accessToken = null; // Invalidate token on error
    tokenExpiryTime = null;
    // Re-throw the caught error (could be network error or the specific auth error)
    throw error;
  }
}


// --- Helper Functions ---

/**
 * Gets the IATA city code for a given city name using Amadeus API.
 * @param cityName The name of the city.
 * @param token The Amadeus access token.
 * @returns A promise resolving to the city code string or null if not found.
 */
async function getCityCode(cityName: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(`${AMADEUS_API_BASE_URL}/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(cityName)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
       const errorBody = await response.text();
       console.error("Amadeus City Lookup Error Response:", errorBody);
       // Try to parse the error for more specific feedback
       try {
         const errorJson = JSON.parse(errorBody);
         if (errorJson.errors && errorJson.errors.length > 0) {
           const firstError = errorJson.errors[0];
           console.error(`Amadeus City Lookup API Error (${firstError.status}): ${firstError.title} - ${firstError.detail || firstError.code}`);
           // Don't throw here, just log and return null
         }
       } catch (parseError) {
         // Ignore parsing error
       }
      console.error(`Amadeus city lookup failed: ${response.status} ${response.statusText}`);
      return null; // Indicate failure to find code
    }

    const data = await response.json();

    if (data && data.data && data.data.length > 0) {
      // Prioritize exact matches or cities over airports if possible
      const city = data.data.find((loc: any) => loc.name.toLowerCase() === cityName.toLowerCase() && loc.subType === 'CITY');
      const code = city ? city.iataCode : data.data[0].iataCode; // Fallback to first result if no exact city match
      console.log(`Found city code for ${cityName}: ${code}`);
      return code;
    } else {
      console.warn(`No city code found for: ${cityName}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching city code for ${cityName}:`, error);
    return null;
  }
}


/**
 * Transforms an Amadeus hotel offer into our application's Hotel type.
 * @param offer The hotel offer object from Amadeus API.
 * @returns A Hotel object.
 */
function transformAmadeusHotelOffer(offer: AmadeusHotelOffer): Hotel {
  const hotelData = offer.hotel;
  const offerPrice = offer.offers?.[0]?.price;

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
    description: hotelData.description?.text || `Eco-friendly stay at ${hotelData.name || 'this hotel'} in ${hotelData.address?.cityName || 'the city'}. Check availability for details.`, // Use description if available
    currency: offerPrice?.currency || 'USD',
  };
}


// --- API Functions ---

/**
 * Searches for hotels using the Amadeus API.
 * @param criteria The search criteria.
 * @returns A promise that resolves to an array of Hotel objects.
 * @throws Error if search fails due to configuration, authentication, or API errors.
 */
export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
  console.log("Searching Amadeus hotels with criteria:", criteria);

  const { city, checkInDate, checkOutDate, numberOfGuests } = criteria;

  // Validate required criteria *before* attempting API calls
  if (!city) {
    console.warn("No city provided for Amadeus search.");
    throw new Error("Please provide a destination city for the search.");
  }
  if (!checkInDate || !checkOutDate) {
      console.warn("Check-in and Check-out dates are required for Amadeus search.");
      throw new Error("Please provide both check-in and check-out dates for the search.");
  }
   if (checkOutDate <= checkInDate) {
      console.warn("Check-out date must be after check-in date.");
      throw new Error("Check-out date must be after check-in date.");
  }
   if (numberOfGuests < 1) {
      console.warn("Number of guests must be at least 1.");
      throw new Error("Please specify at least one guest.");
  }

  // Check if API keys are actually missing or empty *before* attempting to get token
   if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
       console.error("CRITICAL: Amadeus API Key/Secret are missing. Cannot proceed with search. Set NEXT_PUBLIC_AMADEUS_API_KEY and NEXT_PUBLIC_AMADEUS_API_SECRET.");
       // Throw a specific configuration error
       throw new Error("API credentials missing. Search cannot be performed.");
   }


  let token: string | null = null;
  let cityCode: string | null = null;
  let response: Response | null = null;
  const searchUrl = `${AMADEUS_API_BASE_URL}/v2/shopping/hotel-offers`;
  let params: URLSearchParams | null = null;

  try {
    // Get token - This will throw if auth fails (e.g., bad keys, network issues)
    token = await getAmadeusAccessToken();

    // Get City Code
    cityCode = await getCityCode(city, token);
    if (!cityCode) {
      console.warn(`Could not find IATA city code for ${city}. Cannot search Amadeus.`);
      throw new Error(`Could not find location code for "${city}". Please try a different city name or spelling.`);
    }

    // Prepare Search Parameters
    params = new URLSearchParams({
      cityCode: cityCode,
      checkInDate: checkInDate.toISOString().split('T')[0],
      checkOutDate: checkOutDate.toISOString().split('T')[0],
      adults: numberOfGuests.toString(),
      currency: 'USD',
      radius: '20', // Search radius in KM
      radiusUnit: 'KM',
      view: 'LIGHT', // Use 'FULL' for more details if needed (might increase cost/latency)
      bestRateOnly: 'true', // Typically recommended
      // Consider adding sort: 'PRICE' or 'DISTANCE' if needed
    });

    const fullSearchUrl = `${searchUrl}?${params.toString()}`;
    console.log(`Attempting Amadeus Search: GET ${fullSearchUrl}`);

    // Perform Hotel Search
    response = await fetch(fullSearchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Amadeus Hotel Search Error Response Body (Status ${response.status}):`, errorBody);
       // Try to parse the error for more specific feedback
       let apiErrorMessage = `Amadeus hotel search failed: ${response.status} ${response.statusText}`;
       try {
         const errorJson = JSON.parse(errorBody);
         if (errorJson.errors && errorJson.errors.length > 0) {
           const firstError = errorJson.errors[0];
           console.error(`Parsed Amadeus API Error (${firstError.status}): ${firstError.title} - ${firstError.detail || firstError.code}`);
           // Customize message based on common error codes if desired
           if (firstError.code === 38196) { // Example: Invalid date format or range
                apiErrorMessage = `Search failed: ${firstError.title}. Please check your dates.`;
           } else if (firstError.code === 38191) { // Example: Mandatory parameter missing
                apiErrorMessage = `Search failed: Missing required information (${firstError.title}).`;
           } else {
                apiErrorMessage = `Search failed: ${firstError.title} (Code: ${firstError.code})`;
           }
         }
       } catch (parseError) {
          console.warn("Could not parse Amadeus search error response JSON.");
       }
      throw new Error(apiErrorMessage); // Throw the specific API error
    }

    // Process Successful Response
    const data = await response.json();

    if (data && data.data && Array.isArray(data.data)) {
       console.log(`Found ${data.data.length} hotel offers from Amadeus.`);
       // Filter out offers that might be missing essential info like price or hotel details
       const validOffers = data.data.filter((offer: AmadeusHotelOffer) => offer.hotel && offer.offers?.[0]?.price?.total);
        if (validOffers.length < data.data.length) {
            console.warn(`Filtered out ${data.data.length - validOffers.length} offers due to missing hotel or price information.`);
        }
        if (validOffers.length === 0) {
             console.log("Amadeus search returned results, but none had valid hotel and price info after filtering.");
             // No need to throw, just return empty. The UI will handle 'No Results'.
        }
       return validOffers.map(transformAmadeusHotelOffer);
    } else {
      console.warn("No results array found in Amadeus API response or unexpected format:", data);
      return []; // Return empty array for no results or bad format
    }

  } catch (error: any) {
    console.error("-----------------------------------------");
    console.error("Error during Amadeus hotel search process:");
    console.error(`Timestamp: ${new Date().toISOString()}`);
    if (token) console.error("Token used: YES (obtained successfully)"); else console.error("Token used: NO (failed to obtain or not reached)");
    if (cityCode) console.error(`City Code used: ${cityCode}`); else console.error("City Code used: NO (failed to obtain or not reached)");
    if (params) console.error(`Search Params: ${params.toString()}`); else console.error("Search Params: Not generated");
    if (response) {
      console.error(`Fetch Status: ${response.status} ${response.statusText}`);
      console.error("Fetch Headers (Response):", Object.fromEntries(response.headers.entries()));
    } else {
       console.error("Fetch Status: Request likely failed before receiving a response (e.g., network error, CORS, DNS).");
    }
    console.error("Caught Error Object:", error);
    console.error("-----------------------------------------");

    // Attempt to craft a more user-friendly message based on the error type
    let userMessage = "An unexpected error occurred during the hotel search. Please try again later.";
    if (error.message?.includes("Failed to fetch")) {
        userMessage = "Could not connect to the hotel search service. Please check your internet connection and try again.";
    } else if (error.message?.includes("Invalid API Key or Secret")) {
        userMessage = "There's an issue with the API configuration. Please contact support."; // Avoid exposing specifics
    } else if (error.message?.includes("Could not find location code")) {
        userMessage = error.message; // Pass the specific city error through
    } else if (error.message?.includes("check your dates")) {
         userMessage = error.message; // Pass the specific date error through
    }
    // Propagate a new error with a potentially more user-friendly message
    throw new Error(userMessage);
  }
}

/**
 * Simulates booking a hotel.
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
  console.log("Simulating Amadeus booking for hotel:", hotel.name, "with ID:", hotel.id);
  console.log("Payment method (simulated):", paymentDetails.method);

  // TODO: In a real application, this would involve:
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

  console.log("Amadeus Booking successful (simulated):", newTrip);
  return newTrip;
}


// --- Local Storage Trip Management ---

/**
 * Retrieves all trips from localStorage.
 */
export async function getTrips(): Promise<Trip[]> {
  // Ensure this runs only on the client-side
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const tripsJson = localStorage.getItem('ecoTrips');
    if (tripsJson) {
      const parsedTrips: any[] = JSON.parse(tripsJson);
      // Validate and parse dates properly
      return parsedTrips.map(trip => ({
        ...trip,
        checkInDate: new Date(trip.checkInDate),
        checkOutDate: new Date(trip.checkOutDate),
        // Ensure hotel object structure is maintained (it should be if saved correctly)
        hotel: trip.hotel || {}, // Basic check for hotel object
      })).filter(trip => trip.hotel && trip.hotel.id); // Filter out trips missing hotel ID just in case
    }
  } catch (error) {
    console.error("Failed to parse trips from localStorage:", error);
    localStorage.removeItem('ecoTrips'); // Clear corrupted data
  }
  return [];
}

/**
 * Adds a new trip to localStorage.
 */
export async function addTrip(trip: Trip): Promise<void> {
   // Ensure this runs only on the client-side
  if (typeof window !== 'undefined') {
    try {
        const existingTrips = await getTrips();
        const updatedTrips = [...existingTrips, trip];
        localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
        console.error("Failed to save trip to localStorage:", error);
        // Consider adding user feedback here (e.g., toast notification)
    }
  }
}

/**
 * Removes a trip from localStorage by ID.
 */
export async function removeTrip(tripId: string): Promise<void> {
  // Ensure this runs only on the client-side
  if (typeof window !== 'undefined') {
    try {
      let existingTrips = await getTrips();
      const updatedTrips = existingTrips.filter(trip => trip.id !== tripId);
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
      console.error("Failed to remove trip from localStorage:", error);
      // Consider user feedback
    }
  }
}

/**
 * Updates a trip in localStorage (e.g., changing status).
 */
export async function updateTrip(updatedTrip: Trip): Promise<void> {
  // Ensure this runs only on the client-side
  if (typeof window !== 'undefined') {
    try {
      let existingTrips = await getTrips();
      const updatedTrips = existingTrips.map(trip =>
        trip.id === updatedTrip.id ? updatedTrip : trip
      );
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
      console.error("Failed to update trip in localStorage:", error);
      // Consider user feedback
    }
  }
}
