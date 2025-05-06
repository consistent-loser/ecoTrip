"use client";

import { useState, useEffect } from 'react';
import type { Trip } from '@/types';
import { getTrips } from '@/services/booking';
import { TripCard } from '@/components/trip-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CalendarX } from 'lucide-react';

export default function TripsPage() {
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [pastTrips, setPastTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTrips() {
      setIsLoading(true);
      try {
        const allTrips = await getTrips();
        const now = new Date();
        setUpcomingTrips(
          allTrips.filter(trip => new Date(trip.checkOutDate) >= now && trip.status === 'upcoming').sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime())
        );
        setPastTrips(
          allTrips.filter(trip => new Date(trip.checkOutDate) < now || trip.status === 'past' || trip.status === 'cancelled').sort((a,b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime())
        );
      } catch (error) {
        console.error("Failed to load trips:", error);
        // Handle error (e.g., show toast)
      }
      setIsLoading(false);
    }
    loadTrips();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading your trips...</p>
      </div>
    );
  }
  
  const renderTripList = (trips: Trip[], type: 'upcoming' | 'past') => {
    if (trips.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          <CalendarX className="h-16 w-16 mx-auto mb-4" />
          <p className="text-xl">No {type} trips yet.</p>
          {type === 'upcoming' && <p>Ready for an adventure? Book your next eco-trip!</p>}
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    );
  };


  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-4xl font-bold mb-10 text-center text-primary">My Trips</h1>
      
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-1/2 mx-auto mb-8">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          {renderTripList(upcomingTrips, 'upcoming')}
        </TabsContent>
        <TabsContent value="past">
          {renderTripList(pastTrips, 'past')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
