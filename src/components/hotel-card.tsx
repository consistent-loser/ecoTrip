
import Image from 'next/image';
import type { Hotel } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, Wifi, Utensils, ParkingCircle, Dumbbell, Leaf, Waves } from 'lucide-react'; // Example amenities icons

interface HotelCardProps {
  hotel: Hotel;
  onBook: (hotel: Hotel) => void;
}

const amenityIcons: { [key: string]: React.ElementType } = {
  'Free WiFi': Wifi,
  'Restaurant': Utensils,
  'Pool': Waves, 
  'Gym': Dumbbell,
  'Parking': ParkingCircle,
  'Eco-friendly': Leaf,
  'Spa': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 14s1.5-2 4-2 4 2 4 2"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M12 6V2"/></svg>, // Custom Spa icon
  'Pet-friendly': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.5a1 1 0 0 0-1.82-.02L2.5 17.5"/><path d="M19.5 13.5a1 1 0 0 0-1.82.02L7.5 22.5"/><path d="M12 7L21 11"/><path d="M3 11l9-4"/></svg>, // Custom Pet-friendly icon
  'Airport Shuttle': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/><path d="m14 18-3-3 3-3"/><path d="M10 15h10v4H10zM17 4h4v4h-4z"/></svg>, // Custom Airport Shuttle icon
  'Ocean View': Waves,
  'Mountain View': MountainIcon,
};

function MountainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  )
}


export function HotelCard({ hotel, onBook }: HotelCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full bg-card">
      <div className="relative w-full h-48 sm:h-56">
        <Image
          src={hotel.imageUrl}
          alt={hotel.name}
          layout="fill"
          objectFit="cover"
          data-ai-hint="hotel room"
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-card-foreground">{hotel.name}</CardTitle>
        <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
          <MapPin className="h-4 w-4 mr-1 text-primary" />
          {hotel.address}, {hotel.city}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 pt-2 pb-4">
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={`h-5 w-5 ${index < Math.floor(hotel.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
            />
          ))}
          <span className="ml-2 text-sm text-muted-foreground">({hotel.rating.toFixed(1)})</span>
        </div>
        {hotel.amenities && hotel.amenities.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Key Amenities:</h4>
            <div className="flex flex-wrap gap-2">
              {hotel.amenities.slice(0, 4).map((amenity) => {
                const IconComponent = amenityIcons[amenity] || Leaf; // Default to Leaf icon if specific one not found
                return (
                  <span key={amenity} className="flex items-center text-xs bg-accent/10 text-accent-foreground px-2 py-1 rounded-full">
                    <IconComponent className="h-3.5 w-3.5 mr-1.5 text-accent" /> {amenity}
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
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-4 pb-4 px-6 border-t mt-auto bg-secondary/30">
        <p className="text-lg font-bold text-primary">
          ${hotel.pricePerNight}
          <span className="text-xs text-muted-foreground font-normal"> / night</span>
        </p>
        <Button onClick={() => onBook(hotel)} variant="default" size="sm">
          Book Now
        </Button>
      </CardFooter>
    </Card>
  );
}
