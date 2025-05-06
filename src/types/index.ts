
export interface Hotel {
  id: string;
  name: string;
  address: string;
  city: string;
  pricePerNight: number;
  imageUrl: string;
  rating: number; // Rating out of 5
  amenities: string[];
  // Optional fields from Booking.com or similar APIs
  latitude?: number;
  longitude?: number;
  description?: string;
  currency?: string;
}

export interface Trip {
  id: string;
  hotel: Hotel;
  checkInDate: Date;
  checkOutDate: Date;
  numberOfGuests: number;
  totalPrice: number;
  status: 'upcoming' | 'past' | 'cancelled';
}

export interface HotelSearchCriteria {
  city: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  numberOfGuests: number;
}

export interface PaymentDetails {
  method: 'creditCard' | 'paypal' | 'debitCard';
  cardNumber?: string;
  expiryDate?: string;
  cvc?: string;
  paypalEmail?: string;
  debitCardNumber?: string;
}

// Interface for the expected structure of a hotel object from Booking.com API
// This is a simplified example; refer to actual API documentation for complete structure.
export interface BookingComHotel {
  hotel_id: number;
  name?: string; // Or hotel_name
  address?: string;
  city?: string;
  zip?: string;
  country_trans?: string;
  latitude?: number;
  longitude?: number;
  main_photo_url?: string;
  review_score?: string | null; // Often a string like "8.5"
  review_nr?: number;
  min_total_price?: number; // Example, might be nested or vary
  currency_code?: string;
  hotel_facilities?: string; // Comma-separated string of facility names/IDs
  accommodation_type_name?: string;
  // ... other fields from the API
}

    