import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { Hotel } from "@/types";

interface HotelCardProps {
  hotel: Hotel;
  onBook: (hotel: Hotel) => void;
}

export function HotelCard({ hotel, onBook }: HotelCardProps) {
  return (
    <Card className="bg-secondary/50 flex flex-col">
      <CardHeader>
        <CardTitle>{hotel.name}</CardTitle>
        <CardDescription>{hotel.city}</CardDescription>
      </CardHeader>
      <img
        src={hotel.imageUrl}
        alt={`Image of ${hotel.name}`}
        className="aspect-video w-full object-cover rounded-md"
      />
      <CardContent className="grid gap-4 flex-grow">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <span>{hotel.rating}</span>
        </div>
        <p className="text-sm text-muted-foreground">{hotel.description}</p>
        {hotel.amenities && hotel.amenities.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Amenities:</h3>
            <div className="flex gap-2 flex-wrap">
              {hotel.amenities.slice(0, 4).map((amenity, index) => (
                <span key={index} className="px-2 py-1 rounded-full bg-secondary text-xs">
                  {amenity}
                </span>
              ))}
              {hotel.amenities.length > 4 && (
                <span className="px-2 py-1 rounded-full bg-secondary text-xs">
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

    