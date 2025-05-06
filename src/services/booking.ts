import type { Hotel, HotelSearchCriteria, Trip, PaymentDetails } from '@/types';

const mockHotels: Hotel[] = [
  {
    id: '1',
    name: 'Eco Green Paradise',
    address: '123 Nature Lane',
    city: 'Greenville',
    pricePerNight: 200,
    imageUrl: 'https://picsum.photos/seed/hotel1/600/400',
    rating: 4.5,
    amenities: ['Free WiFi', 'Pool', 'Eco-friendly', 'Restaurant'],
  },
  {
    id: '2',
    name: 'Urban Oasis Hotel',
    address: '456 Concrete Ave',
    city: 'Metro City',
    pricePerNight: 150,
    imageUrl: 'https://picsum.photos/seed/hotel2/600/400',
    rating: 4.2,
    amenities: ['Free WiFi', 'Gym', 'Business Center'],
  },
  {
    id: '3',
    name: 'Seaside Serenity Resort',
    address: '789 Ocean Drive',
    city: 'Coastal Town',
    pricePerNight: 250,
    imageUrl: 'https://picsum.photos/seed/hotel3/600/400',
    rating: 4.8,
    amenities: ['Beachfront', 'Pool', 'Spa', 'Free WiFi'],
  },
  {
    id: '4',
    name: 'Mountain View Lodge',
    address: '101 Peak Rd',
    city: 'Greenville', // Same city as Eco Green Paradise for testing
    pricePerNight: 180,
    imageUrl: 'https://picsum.photos/seed/hotel4/600/400',
    rating: 4.3,
    amenities: ['Mountain views', 'Hiking trails', 'Fireplace', 'Free WiFi'],
  },
  {
    id: '5',
    name: 'Budget Friendly Stays',
    address: '222 Side Street',
    city: 'Metro City',
    pricePerNight: 80,
    imageUrl: 'https://picsum.photos/seed/hotel5/600/400',
    rating: 3.5,
    amenities: ['Free WiFi', 'Shared Kitchen'],
  }
];


export async function searchHotels(criteria: HotelSearchCriteria): Promise<Hotel[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const filteredHotels = mockHotels.filter(hotel =>
    hotel.city.toLowerCase().includes(criteria.city.toLowerCase())
  );
  
  return filteredHotels;
}


export async function simulateBookHotel(
  hotel: Hotel,
  checkInDate: Date,
  checkOutDate: Date,
  numberOfGuests: number,
  paymentDetails: PaymentDetails
): Promise<Trip> {
  // Simulate API call delay for booking
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Basic validation (in a real app, this would be more robust)
  if (!hotel || !checkInDate || !checkOutDate || numberOfGuests <= 0 || !paymentDetails) {
    throw new Error("Invalid booking details");
  }

  // Calculate total price (simplified)
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalPrice = nights * hotel.pricePerNight * numberOfGuests;

  const newTrip: Trip = {
    id: `trip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    hotel,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice,
    status: 'upcoming',
  };

  // In a real app, you would save this to a database
  // For this MVP, we'll just return it. We can store it in localStorage on client if needed for trips page.
  console.log("Simulated booking:", newTrip);
  console.log("Payment details:", paymentDetails);
  
  return newTrip;
}

// Mock function to get trips
export async function getTrips(): Promise<Trip[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  // Try to load trips from localStorage or return some mock data
  const storedTrips = typeof window !== 'undefined' ? localStorage.getItem('ecoTripTrips') : null;
  if (storedTrips) {
    const parsedTrips: Trip[] = JSON.parse(storedTrips).map((trip: any) => ({
      ...trip,
      checkInDate: new Date(trip.checkInDate),
      checkOutDate: new Date(trip.checkOutDate),
    }));
    return parsedTrips;
  }

  return [
    {
      id: 'trip1',
      hotel: mockHotels[0],
      checkInDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      checkOutDate: new Date(new Date().setDate(new Date().getDate() + 15)),
      numberOfGuests: 2,
      totalPrice: mockHotels[0].pricePerNight * 5 * 2,
      status: 'upcoming',
    },
    {
      id: 'trip2',
      hotel: mockHotels[2],
      checkInDate: new Date(new Date().setDate(new Date().getDate() - 20)),
      checkOutDate: new Date(new Date().setDate(new Date().getDate() - 15)),
      numberOfGuests: 1,
      totalPrice: mockHotels[2].pricePerNight * 5 * 1,
      status: 'past',
    },
  ];
}

export async function addTrip(trip: Trip): Promise<void> {
  if (typeof window === 'undefined') return;
  const existingTrips = await getTrips();
  const updatedTrips = [...existingTrips, trip];
  localStorage.setItem('ecoTripTrips', JSON.stringify(updatedTrips));
}
