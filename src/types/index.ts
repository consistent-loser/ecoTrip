

export interface Hotel {
  id: string;
  name: string;
  address: string;
  city: string;
  pricePerNight: number; // This might represent total price for the stay from Amadeus Offers
  imageUrl: string;
  rating: number | string; // Amadeus might use string ratings like "4" stars, accommodate both
  amenities: string[];
  // Optional fields from Amadeus or similar APIs
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
  checkInDate?: Date; // Made optional to allow flexibility, but Amadeus requires them
  checkOutDate?: Date; // Made optional to allow flexibility, but Amadeus requires them
  numberOfGuests: number;
}

export interface PaymentDetails {
  method: 'creditCard' | 'paypal' | 'debitCard';
  cardNumber?: string;
  expiryDate?: string;
  cvc?: string;
  paypalEmail?: string;
  debitCardNumber?: string; // Redundant? cardNumber covers both
}

// --- Amadeus Specific Types ---

export interface AmadeusAccessToken {
  type: string;
  username: string;
  application_name: string;
  client_id: string;
  token_type: string;
  access_token: string;
  expires_in: number; // Duration in seconds
  state: string;
  scope: string;
}

// Simplified structure based on Amadeus Hotel Offers API (/v2/shopping/hotel-offers)
// Refer to actual Amadeus API documentation for the complete and accurate structure.
export interface AmadeusHotelOffer {
  type: string; // e.g., "hotel-offers"
  hotel: {
    type: string; // e.g., "hotel"
    hotelId: string; // Amadeus internal ID
    chainCode?: string;
    dupeId?: string;
    name?: string;
    rating?: string; // e.g., "4" for 4 stars
    cityCode?: string;
    latitude?: number;
    longitude?: number;
    address?: {
      lines?: string[];
      postalCode?: string;
      cityName?: string;
      countryCode?: string;
      stateCode?: string; // If applicable
    };
    amenities?: string[]; // Might be limited in Offers API, full list often needs Details API
    description?: { // Often requires Details API (view=FULL) or separate call
        lang?: string;
        text?: string;
    };
    media?: { // Often requires Details API or separate call
        uri?: string;
        category?: string; // e.g., "EXTERIOR", "GUEST_ROOM"
    }[];
    // ... other hotel details
  };
  available: boolean; // Is the offer still available?
  offers?: {
    id: string; // Offer ID
    checkInDate: string; // YYYY-MM-DD
    checkOutDate: string; // YYYY-MM-DD
    rateCode?: string;
    rateFamilyEstimated?: {
        code?: string;
        type?: string;
    };
    room?: { // Details about the room in the offer
        type: string; // e.g., "room"
        typeEstimated?: {
            category?: string; // e.g., "STANDARD_ROOM"
            beds?: number;
            bedType?: string; // e.g., "KING"
        };
        description?: {
            lang?: string;
            text?: string;
        };
    };
    guests?: {
        adults: number;
        // children?: number; // If applicable
    };
    price: { // Price for the entire stay based on search criteria
        currency: string; // e.g., "USD"
        total?: string; // Price as a string, e.g., "250.00"
        base?: string; // Price before taxes
        taxes?: {
            code?: string;
            amount?: string;
            currency?: string;
            included?: boolean;
        }[];
        variations?: {
            average?: { base?: string };
            changes?: { startDate: string; endDate: string; base?: string; total?: string }[];
        };
        // ... other price details like fees
    };
    policies?: { // Cancellation, payment policies etc.
        paymentType?: string; // e.g., "deposit", "guarantee"
        cancellation?: {
            deadline?: string; // ISO 8601 datetime
            description?: { text?: string };
            amount?: string;
            numberOfNights?: number;
        };
        // ... other policies
    };
    self?: string; // Link to the offer itself (useful for pricing/booking steps)
    // ... other offer details
  }[];
  self?: string; // Link to this specific hotel offer result
}

// Interface for the expected structure of a hotel object from Booking.com API
// REMOVED - No longer needed as we switch to Amadeus
// export interface BookingComHotel { ... }
