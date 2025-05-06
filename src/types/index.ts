export interface Hotel {
  id: string;
  name: string;
  address: string;
  city: string;
  pricePerNight: number;
  imageUrl: string;
  rating: number; // Rating out of 5
  amenities: string[];
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
