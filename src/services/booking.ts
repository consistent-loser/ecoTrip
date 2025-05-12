
// WARNING: API calls moved to client-side (page.tsx) as requested.
// This is insecure as API credentials will be exposed in the browser.
// Server Actions ('use server') are the recommended secure approach.

import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails, AmadeusHotelOffer, AmadeusAccessToken } from '@/types';

// --- Amadeus API Configuration (Client-Side - INSECURE) ---
// These will be used directly in the client-side fetch calls in page.tsx.
// Exposing secrets on the client is a major security risk.
const AMADEUS_API_KEY_CLIENT = 'jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9';
const AMADEUS_API_SECRET_CLIENT = 'U1MGYukFmZhrjq40';
const AMADEUS_API_BASE_URL_CLIENT = 'https://test.api.amadeus.com'; // Use https://api.amadeus.com for production


// --- Helper Functions ---

/**
 * Transforms an Amadeus hotel offer into our application's Hotel type.
 * Can run on server or client. Called client-side in this setup.
 * @param offer The hotel offer object from Amadeus API.
 * @returns A Hotel object.
 */
export function transformAmadeusHotelOffer(offer: AmadeusHotelOffer): Hotel {
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
    rating: rating > 0 && rating <= 5 ? rating : (Math.random() * 1.5 + 3).toFixed(1),
    amenities: amenities.slice(0, 6),
    latitude: hotelData.latitude,
    longitude: hotelData.longitude,
    description: description,
    currency: offerPrice?.currency || 'USD',
  };
}


// --- API Functions (Client-Side Implementation in page.tsx) ---

// Functions like getAmadeusAccessToken, getCityCode, searchHotels are now
// implemented directly within the handleSearch function in src/app/page.tsx
// to perform client-side fetching as requested by the user.

/**
 * Simulates booking a hotel. Runs Client-Side now.
 * This function would interact with Amadeus's booking APIs in a real app (ideally server-side).
 */
export async function simulateBookHotel_Client(
  hotel: Hotel,
  checkInDate: Date,
  checkOutDate: Date,
  numberOfGuests: number,
  paymentDetails: PaymentDetails
): Promise<Trip> {
  console.log("Simulating Amadeus booking (Client-Side - INSECURE if real API calls were made here) for hotel:", hotel.name);
  console.log("Payment method (simulated):", paymentDetails.method);

  // TODO: In a real application, server-side calls would be needed for secure booking.
  // 1. Re-fetch price (server-side)
  // 2. Create booking (server-side)

  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

  const totalPrice = hotel.pricePerNight; // Assuming pricePerNight is total stay price

  const newTrip: Trip = {
    id: `trip-amadeus-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hotel,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice: totalPrice,
    status: 'upcoming',
  };

  console.log("Client-Side Booking successful (simulated):", newTrip);
  // The calling function (handlePaymentSubmit in page.tsx) will call addTrip (localStorage).
  return newTrip;
}


// --- Local Storage Trip Management ---
// These functions interact with localStorage and MUST run client-side.

/**
 * Retrieves all trips from localStorage. Client-side only.
 */
export async function getTrips(): Promise<Trip[]> {
  if (typeof window === 'undefined') {
    console.warn("Attempted to call getTrips (localStorage) on the server.");
    return [];
  }
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
    console.error("Failed to parse trips from localStorage:", error);
    localStorage.removeItem('ecoTrips');
  }
  return [];
}

/**
 * Adds a new trip to localStorage. Client-side only.
 */
export async function addTrip(trip: Trip): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn("Attempted to call addTrip (localStorage) on the server.");
    return;
  }
    try {
        const existingTrips = await getTrips();
        const updatedTrips = [...existingTrips, trip];
        localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
        console.error("Failed to save trip to localStorage:", error);
    }
}

/**
 * Removes a trip from localStorage by ID. Client-side only.
 */
export async function removeTrip(tripId: string): Promise<void> {
  if (typeof window === 'undefined') {
     console.warn("Attempted to call removeTrip (localStorage) on the server.");
    return;
  }
    try {
      let existingTrips = await getTrips();
      const updatedTrips = existingTrips.filter(trip => trip.id !== tripId);
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
      console.error("Failed to remove trip from localStorage:", error);
    }
}

/**
 * Updates a trip in localStorage (e.g., changing status). Client-side only.
 */
export async function updateTrip(updatedTrip: Trip): Promise<void> {
 if (typeof window === 'undefined') {
     console.warn("Attempted to call updateTrip (localStorage) on the server.");
    return;
  }
    try {
      let existingTrips = await getTrips();
      const updatedTrips = existingTrips.map(trip =>
        trip.id === updatedTrip.id ? updatedTrip : trip
      );
      localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
    } catch (error) {
      console.error("Failed to update trip in localStorage:", error);
    }
}


// --- Client-Side Amadeus API Constants (defined again for clarity) ---
// WARNING: Exposing secrets on the client is a major security risk.
export const CLIENT_AMADEUS_CONFIG = {
  apiKey: 'jPwfhVR27QjkTnqgNObpCJo9EbpEGTe9',
  apiSecret: 'U1MGYukFmZhrjq40',
  baseUrl: 'https://test.api.amadeus.com'
};
