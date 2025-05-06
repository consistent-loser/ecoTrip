
import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails, BookingComHotel } from '@/types';

// --- Environment Variables ---
// Accessing environment variables in Next.js:
// For server-side code (like API routes or `getServerSideProps`), use `process.env.BOOKING_API_KEY`.
// For client-side code, prefix with `NEXT_PUBLIC_` like `process.env.NEXT_PUBLIC_BOOKING_API_KEY`.
// Ensure these are set in your .env.local file.
const BOOKING_API_KEY = process.env.NEXT_PUBLIC_BOOKING_API_KEY || 'YOUR_BOOKING_COM_API_KEY';
const BOOKING_API_HOST = 'booking-com.p.rapidapi.com'; // Example, adjust if different

// --- Mock Data (Kept for fallback or if API integration is partial) ---
const CITIES = ["Greenville", "Metro City", "Oceanview", "Mountain Peak", "Desert Oasis"];
const HOTEL_NAMES_PREFIX = ["Eco", "Green", "Sustainable", "Nature", "Earth"];
const HOTEL_NAMES_SUFFIX = ["Lodge", "Retreat", "Inn", "Resort", "Suites", "Oasis"];
const AMENITIES_LIST = [
  "Free WiFi", "Restaurant", "Pool", "Gym", "Parking", 
  "Spa", "Pet-friendly", "Airport Shuttle", "Eco-friendly", "Ocean View", "Mountain View"
];

const mockHotels: Hotel[] = Array.from({ length: 50 }, (_, i) => {
  const city = CITIES[i % CITIES.length];
  const prefix = HOTEL_NAMES_PREFIX[i % HOTEL_NAMES_PREFIX.length];
  const suffix = HOTEL_NAMES_SUFFIX[i % HOTEL_NAMES_SUFFIX.length];
  const name = `${prefix} ${suffix} ${city}`;
  
  const shuffledAmenities = [...AMENITIES_LIST].sort(() => 0.5 - Math.random());
  const numAmenities = Math.floor(Math.random() * 4) + 3; // 3 to 6 amenities
  const hotelAmenities = shuffledAmenities.slice(0, numAmenities);

  return {
    id: (i + 1).toString(),
    name: name,
    address: `${Math.floor(Math.random() * 900) + 100} Eco Park Rd`,
    city: city,
    pricePerNight: Math.floor(Math.random() * 200) + 50,
    imageUrl: `https://picsum.photos/seed/${i+1}-hotel/400/300`,
    rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
    amenities: hotelAmenities,
    // New fields that might come from Booking.com
    latitude: (Math.random() * 180 - 90), // Example latitude
    longitude: (Math.random() * 360 - 180), // Example longitude
    description: `A wonderful ${name} in ${city} offering great comfort and eco-friendly practices.`,
    currency: 'USD',
  };
});


// --- Helper Functions ---
/**
 * Transforms a Booking.com hotel object into our application's Hotel type.
 * @param apiHotel The hotel object from Booking.com API.
 * @returns A Hotel object.
 */
function transformBookingComHotel(apiHotel: BookingComHotel): Hotel {
  // This is a conceptual transformation. Actual field names will vary.
  return {
    id: apiHotel.hotel_id.toString(),
    name: apiHotel.name || 'Unknown Hotel Name',
    address: apiHotel.address || 'Address not available',
    city: apiHotel.city || 'City not available',
    pricePerNight: apiHotel.min_total_price || 0, // Or some other price field
    imageUrl: apiHotel.main_photo_url || `https://picsum.photos/seed/${apiHotel.hotel_id}/400/300`,
    rating: apiHotel.review_score ? parseFloat(apiHotel.review_score) / 2 : 0, // Booking.com rating is often 0-10
    amenities: apiHotel.hotel_facilities ? apiHotel.hotel_facilities.split(',').map(f => f.trim()) : [],
    latitude: apiHotel.latitude,
    longitude: apiHotel.longitude,
    description: apiHotel.accommodation_type_name || 'No description available.', // Placeholder
    currency: apiHotel.currency_code || 'USD',
  };
}


// --- API Functions ---

/**
 * Searches for hotels using the Booking.com API.
 * @param criteria The search criteria.
 * @returns A promise that resolves to an array of Hotel objects.
 */
export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
  console.log("Searching hotels with criteria:", criteria);

  if (BOOKING_API_KEY === 'YOUR_BOOKING_COM_API_KEY' || !BOOKING_API_KEY) {
    console.warn("Booking.com API key not configured. Falling back to mock data.");
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    let filteredMockHotels = mockHotels;
    if (criteria.city) {
      filteredMockHotels = filteredMockHotels.filter(hotel => 
        hotel.city.toLowerCase().includes(criteria.city.toLowerCase())
      );
    }
    return filteredMockHotels.slice(0, 15);
  }

  const { city, checkInDate, checkOutDate, numberOfGuests } = criteria;
  
  // Construct the API URL (this is an example, refer to Booking.com API docs)
  const params = new URLSearchParams({
    dest_type: 'city',
    dest_id: '', // You'll need to get destination IDs, e.g., from /search/destination
    locale: 'en-gb',
    order_by: 'popularity',
    filter_by_currency: 'USD', // Or user's preferred currency
    adults_number: numberOfGuests.toString(),
    room_number: '1', // Simplified: 1 room
    units: 'metric', // or 'imperial'
  });

  if (city) {
    // First, get destination ID for the city
    try {
      const destResponse = await fetch(`https://${BOOKING_API_HOST}/v1/hotels/locations?name=${encodeURIComponent(city)}&locale=en-gb`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': BOOKING_API_KEY,
          'X-RapidAPI-Host': BOOKING_API_HOST,
        },
      });
      if (!destResponse.ok) throw new Error(`Failed to fetch destination ID: ${destResponse.statusText}`);
      const destData = await destResponse.json();
      // Assuming the first result is the correct one. Error handling and disambiguation needed in a real app.
      if (destData && destData.length > 0 && destData[0].dest_id) {
        params.set('dest_id', destData[0].dest_id);
      } else {
        console.warn(`Could not find destination ID for city: ${city}. Falling back to mock data.`);
        return mockHotels.filter(h => h.city.toLowerCase().includes(city.toLowerCase())).slice(0,15);
      }
    } catch (error) {
      console.error("Error fetching destination ID:", error);
      // Fallback to mock data or return empty array
      return mockHotels.filter(h => h.city.toLowerCase().includes(city.toLowerCase())).slice(0,15);
    }
  } else {
     console.warn("No city provided for search. Returning empty results.");
     return []; // Or return some popular hotels if no city is given
  }


  if (checkInDate) params.set('checkin_date', checkInDate.toISOString().split('T')[0]);
  if (checkOutDate) params.set('checkout_date', checkOutDate.toISOString().split('T')[0]);

  try {
    const response = await fetch(`https://${BOOKING_API_HOST}/v1/hotels/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': BOOKING_API_KEY,
        'X-RapidAPI-Host': BOOKING_API_HOST,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Booking.com API error response:", errorBody);
      throw new Error(`Booking.com API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data && data.result && Array.isArray(data.result)) {
      return data.result.map(transformBookingComHotel);
    } else {
      console.warn("No results from Booking.com API or unexpected format:", data);
      return [];
    }

  } catch (error) {
    console.error("Error fetching hotels from Booking.com API:", error);
    // Fallback to mock data on API error
    console.warn("Falling back to mock data due to API error.");
    let filteredMockHotels = mockHotels;
    if (criteria.city) {
      filteredMockHotels = filteredMockHotels.filter(hotel => 
        hotel.city.toLowerCase().includes(criteria.city.toLowerCase())
      );
    }
    return filteredMockHotels.slice(0, 15);
  }
}

/**
 * Simulates booking a hotel.
 * This function would interact with Booking.com's booking API.
 * For now, it remains a simulation.
 */
export async function simulateBookHotel(
  hotel: Hotel,
  checkInDate: Date,
  checkOutDate: Date,
  numberOfGuests: number,
  paymentDetails: PaymentDetails
): Promise<Trip> {
  console.log("Simulating booking for hotel:", hotel.name, "Payment via:", paymentDetails.method);
  // TODO: In a real application, this would interact with a booking system and payment gateway.
  // This would involve more complex API calls to Booking.com's booking endpoints.
  
  await new Promise(resolve => setTimeout(resolve, 1500));

  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalPrice = nights * hotel.pricePerNight * numberOfGuests;

  const newTrip: Trip = {
    id: `trip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hotel,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice,
    status: 'upcoming',
  };
  
  console.log("Booking successful (simulated):", newTrip);
  return newTrip;
}

/**
 * Retrieves all trips from localStorage.
 */
export async function getTrips(): Promise<Trip[]> {
  if (typeof window !== 'undefined') {
    const tripsJson = localStorage.getItem('ecoTrips');
    if (tripsJson) {
      const parsedTrips: Trip[] = JSON.parse(tripsJson);
      return parsedTrips.map(trip => ({
        ...trip,
        checkInDate: new Date(trip.checkInDate),
        checkOutDate: new Date(trip.checkOutDate),
      }));
    }
  }
  return [];
}

/**
 * Adds a new trip to localStorage.
 */
export async function addTrip(trip: Trip): Promise<void> {
   if (typeof window !== 'undefined') {
    const existingTrips = await getTrips();
    const updatedTrips = [...existingTrips, trip];
    localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
  }
}

    