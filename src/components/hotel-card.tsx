
import Image from 'next/image';
import type { Hotel } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, Wifi, Utensils, ParkingCircle, Dumbbell, Leaf, Waves } from 'lucide-react'; // Example amenities icons

interface HotelCardProps {
  hotel: Hotel;
  onBook: (hotel: Hotel) => void;
}

// Define mapping for known amenities to icons
const amenityIcons: { [key: string]: React.ElementType } = {
  'WIFI': Wifi, // Example mapping for potential Amadeus codes/keywords
  'RESTAURANT': Utensils,
  'PARKING': ParkingCircle,
  'SWIMMING_POOL': Waves, // Map 'Pool' and 'SWIMMING_POOL'
  'Pool': Waves,
  'FITNESS_CENTER': Dumbbell, // Map 'Gym' and 'FITNESS_CENTER'
  'Gym': Dumbbell,
  'PETS_ALLOWED': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.5a1 1 0 0 0-1.82-.02L2.5 17.5"/><path d="M19.5 13.5a1 1 0 0 0-1.82.02L7.5 22.5"/><path d="M12 7L21 11"/><path d="M3 11l9-4"/></svg>, // Custom Pet-friendly icon
  'Pet-friendly': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.5a1 1 0 0 0-1.82-.02L2.5 17.5"/><path d="M19.5 13.5a1 1 0 0 0-1.82.02L7.5 22.5"/><path d="M12 7L21 11"/><path d="M3 11l9-4"/></svg>,
  'AIRPORT_SHUTTLE': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/><path d="m14 18-3-3 3-3"/><path d="M10 15h10v4H10zM17 4h4v4h-4z"/></svg>,
  'Airport Shuttle': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/><path d="m14 18-3-3 3-3"/><path d="M10 15h10v4H10zM17 4h4v4h-4z"/></svg>,
  'SPA': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 14s1.5-2 4-2 4 2 4 2"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M12 6V2"/></svg>, // Custom Spa icon
  'Spa': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 14s1.5-2 4-2 4 2 4 2"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M12 6V2"/></svg>,
  'OCEAN_VIEW': Waves,
  'Ocean View': Waves,
  'MOUNTAIN_VIEW': MountainIcon,
  'Mountain View': MountainIcon,
  'Eco-friendly': Leaf, // Keep custom ones if needed
  'Free WiFi': Wifi,
  'Restaurant': Utensils,
  'Parking': ParkingCircle,
  'Gym': Dumbbell,
  // Add more mappings as needed based on Amadeus amenity codes/strings
};


function MountainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  )
}


export function HotelCard({ hotel, onBook }: HotelCardProps) {
  // Convert rating (which might be string like "4") to a number for star display
  const numericRating = typeof hotel.rating === 'string' ? parseInt(hotel.rating, 10) : hotel.rating;
  const displayRating = isNaN(numericRating) || numericRating < 0 || numericRating > 5 ? 0 : numericRating; // Ensure rating is valid (0-5)

  // Price display - Amadeus often gives total price for the stay
  const priceDisplay = hotel.pricePerNight ? `$${hotel.pricePerNight.toFixed(2)}` : 'N/A';
  const priceSuffix = ' total'; // Indicate it's likely total price

  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full bg-card group">
      <div className="relative w-full h-48 sm:h-56">
        <Image
          src={hotel.imageUrl}
          alt={`Image of ${hotel.name}`} // More descriptive alt text
          layout="fill"
          objectFit="cover"
          data-ai-hint="hotel exterior" // Add AI hint
          className="transition-transform duration-300 group-hover:scale-105"
          // Add placeholder and error handling if needed
          // placeholder="blur"
          // blurDataURL="data:..."
          // onError={(e) => e.currentTarget.src = '/placeholder-hotel.png'} // Fallback image
        />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-card-foreground">{hotel.name}</CardTitle>
        <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
          <MapPin className="h-4 w-4 mr-1 text-primary" />
          {/* Display only city if address is too long or unavailable */}
          {hotel.city || hotel.address}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 pt-2 pb-4">
        {/* Star Rating Display */}
        {displayRating > 0 && (
           <div className="flex items-center">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`h-5 w-5 ${index < Math.floor(displayRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
              />
            ))}
            <span className="ml-2 text-sm text-muted-foreground">({displayRating.toFixed(1)})</span>
          </div>
        )}
         {displayRating === 0 && (
             <div className="flex items-center">
                <span className="text-sm text-muted-foreground">Rating not available</span>
            </div>
         )}


        {/* Amenities Display */}
        {hotel.amenities && hotel.amenities.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Key Amenities:</h4>
            <div className="flex flex-wrap gap-2">
              {hotel.amenities.slice(0, 4).map((amenity) => {
                // Find icon based on known keys (case-insensitive check might be better)
                const IconComponent = amenityIcons[amenity] || Leaf; // Default to Leaf icon
                // Normalize amenity text (e.g., replace underscores, title case)
                const formattedAmenity = amenity.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

                return (
                  <span key={amenity} className="flex items-center text-xs bg-gray-800 text-white px-2 py-1 rounded-full"> {/* Dark background */}
                    <IconComponent className="h-3.5 w-3.5 mr-1.5 text-gray-300" /> {formattedAmenity}
                  </span>
                );
              })}
               {hotel.amenities.length > 4 && (
                <span className="text-xs text-muted-foreground self-center ml-1">
                  +{hotel.amenities.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
         {/* Add description if available */}
         {hotel.description && (
             <p className="text-sm text-muted-foreground pt-2">{hotel.description.substring(0, 100)}{hotel.description.length > 100 ? '...' : ''}</p>
         )}
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-4 pb-4 px-6 border-t mt-auto bg-secondary/30">
        <p className="text-lg font-bold text-primary">
          {priceDisplay}
          {hotel.pricePerNight > 0 && <span className="text-xs text-muted-foreground font-normal">{priceSuffix} ({hotel.currency})</span>}
        </p>
        <Button onClick={() => onBook(hotel)} variant="default" size="sm" disabled={!hotel.pricePerNight || hotel.pricePerNight <= 0}>
          {hotel.pricePerNight && hotel.pricePerNight > 0 ? 'View Offer' : 'Unavailable'}
        </Button>
      </CardFooter>
    </Card>
  );
}
