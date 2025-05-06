
import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails } from '@/types';

// --- Mock Data ---
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
  
  // Ensure unique amenities for each hotel, picking 3 to 6 random ones
  const shuffledAmenities = [...AMENITIES_LIST].sort(() => 0.5 - Math.random());
  const numAmenities = Math.floor(Math.random() * 4) + 3; // 3 to 6 amenities
  const hotelAmenities = shuffledAmenities.slice(0, numAmenities);

  return {
    id: (i + 1).toString(),
    name: name,
    address: `${Math.floor(Math.random() * 900) + 100} Eco Park Rd`,
    city: city,
    pricePerNight: Math.floor(Math.random() * 200) + 50, // Price between $50 and $250
    imageUrl: `https://picsum.photos/seed/${i+1}-hotel/400/300`,
    rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // Rating between 3.0 and 5.0
    amenities: hotelAmenities,
  };
});

let mockTrips: Trip[] = [];

// --- API Functions ---

/**
 * Asynchronously searches for hotels based on the provided criteria.
 * This function simulates an API call.
 *
 * @param criteria The search criteria.
 * @returns A promise that resolves to an array of Hotel objects.
 */
export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
  console.log("Searching hotels with criteria:", criteria);
  // TODO: Replace this with an actual call to the Booking.com API.
  // Example: const response = await fetch(`https://api.booking.com/v1/hotels?city=${criteria.city}&...`);
  // const data = await response.json();
  // return data.hotels;

  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

  const { city, numberOfGuests } = criteria; // checkInDate and checkOutDate are optional here as per form
  
  let filteredHotels = mockHotels;

  if (city) {
    filteredHotels = filteredHotels.filter(hotel => 
      hotel.city.toLowerCase().includes(city.toLowerCase())
    );
  }
  
  // Further filtering could be done based on numberOfGuests capacity, availability for dates, etc.
  // For this mock, we'll just return hotels in the city.
  
  return filteredHotels.slice(0, 15); // Return a subset for display
}

/**
 * Simulates booking a hotel.
 * This function simulates an API call to book a hotel.
 *
 * @param hotel The hotel to book.
 * @param checkInDate The check-in date.
 * @param checkOutDate The check-out date.
 * @param numberOfGuests The number of guests.
 * @param paymentDetails Details for the simulated payment.
 * @returns A promise that resolves to a Trip object representing the booking.
 */
export async function simulateBookHotel(
  hotel: Hotel,
  checkInDate: Date,
  checkOutDate: Date,
  numberOfGuests: number,
  paymentDetails: PaymentDetails // Added for completeness, though not used in mock logic beyond console log
): Promise<Trip> {
  console.log("Simulating booking for hotel:", hotel.name, "Payment via:", paymentDetails.method);
  // TODO: In a real application, this would interact with a booking system and payment gateway.
  
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate booking process delay

  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalPrice = nights * hotel.pricePerNight * numberOfGuests; // Simplified calculation

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
 * @returns A promise that resolves to an array of Trip objects.
 */
export async function getTrips(): Promise<Trip[]> {
  if (typeof window !== 'undefined') {
    const tripsJson = localStorage.getItem('ecoTrips');
    if (tripsJson) {
      const parsedTrips: Trip[] = JSON.parse(tripsJson);
      // Dates are stored as strings in JSON, need to convert back to Date objects
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
 * @param trip The Trip object to add.
 * @returns A promise that resolves when the trip is added.
 */
export async function addTrip(trip: Trip): Promise<void> {
   if (typeof window !== 'undefined') {
    const existingTrips = await getTrips();
    const updatedTrips = [...existingTrips, trip];
    localStorage.setItem('ecoTrips', JSON.stringify(updatedTrips));
  }
}

// Potentially add functions to modify or cancel trips in the future
// export async function cancelTrip(tripId: string): Promise<void> { ... }
// export async function modifyTrip(tripId: string, newDetails: Partial<Trip>): Promise<Trip> { ... }
