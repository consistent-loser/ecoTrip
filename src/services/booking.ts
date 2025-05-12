
import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails, AmadeusHotelOffer, AmadeusAccessToken } from '@/types';

// --- Amadeus API Configuration ---
// IMPORTANT: In a real application, NEVER hardcode API keys. Use environment variables.
// Example .env.local:
// AMADEUS_API_KEY=jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9secret
// AMADEUS_API_SECRET=U1MGYukFmZhrjq40
const AMADEUS_API_KEY = process.env.NEXT_PUBLIC_AMADEUS_API_KEY || 'jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9secret'; // Replace with process.env.AMADEUS_API_KEY on server
const AMADEUS_API_SECRET = process.env.NEXT_PUBLIC_AMADEUS_API_SECRET || 'U1MGYukFmZhrjq40'; // Replace with process.env.AMADEUS_API_SECRET on server
const AMADEUS_API_BASE_URL = 'https://test.api.amadeus.com'; // Use https://api.amadeus.com for production

// --- Amadeus Authentication ---
let accessToken: AmadeusAccessToken | null = null;
let tokenExpiryTime: number | null = null;

/**
 * Fetches or retrieves a cached Amadeus API access token.
 * @returns A promise that resolves to the access token string.
 */
async function getAmadeusAccessToken(): Promise<string> {
  const now = Date.now();

  if (accessToken && tokenExpiryTime && now < tokenExpiryTime) {
    // console.log("Using cached Amadeus token");
    return accessToken.access_token;
  }

  console.log("Fetching new Amadeus token...");
  try {
    const response = await fetch(`${AMADEUS_API_BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Amadeus Auth Error Response:", errorBody);
      throw new Error(`Amadeus auth failed: ${response.status} ${response.statusText}`);
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
    throw error; // Re-throw error to be handled by the caller
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
      throw new Error(`Amadeus city lookup failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data && data.data && data.data.length > 0) {
      // Prioritize exact matches or cities over airports if possible
      const city = data.data.find((loc: any) => loc.name.toLowerCase() === cityName.toLowerCase() && loc.subType === 'CITY');
      return city ? city.iataCode : data.data[0].iataCode; // Fallback to first result if no exact city match
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
  const imageUrl = `https://picsum.photos/seed/${hotelData.hotelId || Math.random()}/400/300`;

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
    pricePerNight: offerPrice?.total ? parseFloat(offerPrice.total) : 0, // Price might be per stay, adjust logic if needed
    imageUrl: imageUrl,
    rating: rating > 0 && rating <= 5 ? rating : (Math.random() * 2 + 3).toFixed(1), // Use rating if valid, else random fallback
    amenities: amenities.slice(0, 6), // Limit displayed amenities
    latitude: hotelData.latitude,
    longitude: hotelData.longitude,
    description: `Eco-friendly stay at ${hotelData.name || 'this hotel'} in ${hotelData.address?.cityName || 'the city'}. Check availability for details.`, // Generic description
    currency: offerPrice?.currency || 'USD',
  };
}


// --- API Functions ---

/**
 * Searches for hotels using the Amadeus API.
 * @param criteria The search criteria.
 * @returns A promise that resolves to an array of Hotel objects.
 */
export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
  console.log("Searching Amadeus hotels with criteria:", criteria);

  // Check if API keys are placeholder values
  if (AMADEUS_API_KEY === 'jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9secret' || !AMADEUS_API_KEY || AMADEUS_API_SECRET === 'U1MGYukFmZhrjq40' || !AMADEUS_API_SECRET) {
      console.error("Amadeus API Key/Secret not configured. Please set AMADEUS_API_KEY and AMADEUS_API_SECRET environment variables.");
      // Optionally, you could throw an error or return mock data here.
      // For now, returning empty to indicate configuration issue.
      // alert("Amadeus API is not configured correctly."); // Alerting might be too intrusive
      return [];
  }


  const { city, checkInDate, checkOutDate, numberOfGuests } = criteria;

  if (!city) {
    console.warn("No city provided for Amadeus search.");
    return [];
  }
  if (!checkInDate || !checkOutDate) {
      console.warn("Check-in and Check-out dates are required for Amadeus search.");
      return [];
  }

  try {
    const token = await getAmadeusAccessToken();
    const cityCode = await getCityCode(city, token);

    if (!cityCode) {
      console.warn(`Could not find IATA city code for ${city}. Cannot search Amadeus.`);
      return [];
    }

    const params = new URLSearchParams({
      cityCode: cityCode,
      checkInDate: checkInDate.toISOString().split('T')[0],
      checkOutDate: checkOutDate.toISOString().split('T')[0],
      adults: numberOfGuests.toString(),
      // Optional parameters:
      // roomQuantity: '1',
      // priceRange: '100-300',
      currency: 'USD',
      // paymentPolicy: 'NONE', // Check API docs for options
      // boardType: 'ROOM_ONLY', // Check API docs for options
      // ratings: '4,5', // Example: 4 and 5 stars
      // amenities: 'WIFI,PARKING', // Example: Request specific amenities
      radius: '20', // Search radius in KM
      radiusUnit: 'KM',
      // hotelSource: 'ALL', // Consider 'CACHE' vs 'REAL_TIME' based on needs
      view: 'LIGHT', // Use 'FULL' for more details, 'LIGHT' for less
      bestRateOnly: 'true',
    });

    const response = await fetch(`${AMADEUS_API_BASE_URL}/v2/shopping/hotel-offers?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Amadeus Hotel Search Error Response:", errorBody);
      throw new Error(`Amadeus hotel search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data && data.data && Array.isArray(data.data)) {
       console.log(`Found ${data.data.length} hotel offers from Amadeus.`);
       // Filter out offers that might be missing essential info like price or hotel details
       const validOffers = data.data.filter((offer: AmadeusHotelOffer) => offer.hotel && offer.offers?.[0]?.price?.total);
       return validOffers.map(transformAmadeusHotelOffer);
    } else {
      console.warn("No results from Amadeus API or unexpected format:", data);
      return [];
    }

  } catch (error) {
    console.error("Error fetching hotels from Amadeus API:", error);
    // Depending on the error (e.g., auth vs. network), you might handle differently.
    // Returning empty array on error.
    return [];
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
  // 2. Creating the booking (Hotel Booking API: /v1/booking/hotel-bookings)
  // This requires handling traveler information, payment details (securely!), and API responses.

  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay for booking

  // Calculate total price based on fetched pricePerNight (which might be per stay from Amadeus, adjust if needed)
  // If pricePerNight from transform is actually total price, use that directly. Let's assume it's per night for now.
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  const totalPrice = hotel.pricePerNight * nights; // Adjust calculation if pricePerNight represents total stay price

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
      })).filter(trip => trip.hotel.id); // Filter out trips missing hotel ID just in case
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
    }
  }
}
