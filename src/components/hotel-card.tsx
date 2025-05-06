import Image from 'next/image';
import type { Hotel } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, Wifi, Utensils, ParkingCircle, Dumbbell } from 'lucide-react'; // Example amenities icons

interface HotelCardProps {
  hotel: Hotel;
  onBook: (hotel: Hotel) => void;
}

const amenityIcons: { [key: string]: React.ElementType } = {
  'Free WiFi': Wifi,
  'Restaurant': Utensils,
  'Pool': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.33 18.33a4 4 0 0 0-5.66 0"/><path d="M12 12a4 4 0 0 0 0 5.66"/><path d="M12 12a4 4 0 0 0 0-5.66"/><path d="m5.67 5.67_a4 4 0 0 0 0 5.66"/><path d="M22 2l-2.5 2.5"/><path d="M2 22l2.5-2.5"/><path d="M20 22l-2.5-2.5"/><path d="M2 2l2.5 2.5"/><path d="M12 6V2"/><path d="M12 22v-4"/><path d="M6 12H2"/><path d="M22 12h-4"/></svg>, // Custom Pool icon
  'Gym': Dumbbell,
  'Parking': ParkingCircle,
  'Eco-friendly': () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 17.607c-2.398 0-4.366-1.63-4.973-3.84.003-.007.005-.014.005-.021 0-.096.018-.19.05-.281A5.008 5.008 0 0 1 12 8c2.76 0 5 2.24 5 5a4.987 4.987 0 0 1-1.027 3.086c.032.09.05.185.05.281 0 .007.002.014.005.021-.607 2.21-2.575 3.84-4.973 3.84zM9 12s1.5-2 3-2 3 2 3 2"/></svg> // Custom Eco icon
};


export function HotelCard({ hotel, onBook }: HotelCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
      <div className="relative w-full h-48 sm:h-56">
        <Image
          src={hotel.imageUrl}
          alt={hotel.name}
          layout="fill"
          objectFit="cover"
          data-ai-hint="hotel room"
        />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">{hotel.name}</CardTitle>
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
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Amenities:</h4>
            <div className="flex flex-wrap gap-2">
              {hotel.amenities.slice(0, 4).map((amenity) => {
                const IconComponent = amenityIcons[amenity] || (() => <span className="text-xs">•</span>);
                return (
                  <span key={amenity} className="flex items-center text-xs bg-accent/10 text-accent-foreground_dark px-2 py-1 rounded-full">
                    <IconComponent className="h-3 w-3 mr-1 text-accent" /> {amenity}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-0 pb-4 px-6 border-t mt-auto">
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
