import Image from 'next/image';
import type { Trip } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, MapPin, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface TripCardProps {
  trip: Trip;
}

export function TripCard({ trip }: TripCardProps) {
  const getStatusIcon = () => {
    switch (trip.status) {
      case 'upcoming':
        return <Clock className="h-4 w-4 mr-2 text-blue-500" />;
      case 'past':
        return <CheckCircle className="h-4 w-4 mr-2 text-green-500" />;
      case 'cancelled':
        return <MapPin className="h-4 w-4 mr-2 text-red-500" />; // Using MapPin as a placeholder for cancel icon
      default:
        return null;
    }
  };

  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col md:flex-row">
      <div className="relative w-full md:w-1/3 h-48 md:h-auto">
        <Image
          src={trip.hotel.imageUrl}
          alt={trip.hotel.name}
          layout="fill"
          objectFit="cover"
          data-ai-hint="travel destination"
        />
      </div>
      <div className="w-full md:w-2/3">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">{trip.hotel.name}</CardTitle>
          <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
            <MapPin className="h-4 w-4 mr-1 text-primary" />
            {trip.hotel.address}, {trip.hotel.city}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center text-sm">
            {getStatusIcon()}
            <span className={`font-medium capitalize ${
              trip.status === 'upcoming' ? 'text-blue-600' :
              trip.status === 'past' ? 'text-green-600' :
              'text-red-600'
            }`}>{trip.status}</span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 mr-2 text-primary" />
            {format(new Date(trip.checkInDate), 'PPP')} - {format(new Date(trip.checkOutDate), 'PPP')}
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-2 text-primary" />
            {trip.numberOfGuests} guest{trip.numberOfGuests > 1 ? 's' : ''}
          </div>
           <div className="flex items-center text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4 mr-2 text-primary" />
            Total: ${trip.totalPrice.toFixed(2)}
          </div>
        </CardContent>
        {trip.status === 'upcoming' && (
          <CardFooter>
            <Button variant="outline" size="sm" className="mr-2">Modify Booking</Button>
            <Button variant="destructive" size="sm">Cancel Booking</Button>
          </CardFooter>
        )}
         {trip.status === 'past' && (
          <CardFooter>
            <Button variant="secondary" size="sm" className="mr-2">Leave a Review</Button>
            <Button variant="default" size="sm">Book Again</Button>
          </CardFooter>
        )}
      </div>
    </Card>
  );
}
