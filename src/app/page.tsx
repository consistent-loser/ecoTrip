"use client";

import { useState, useEffect } from 'react';
import type { Hotel, HotelSearchCriteria, PaymentDetails } from '@/types';
import { searchHotels, simulateBookHotel, addTrip } from '@/services/booking';
import { HotelSearchForm } from '@/components/hotel-search-form';
import { HotelCard } from '@/components/hotel-card';
import { PaymentForm } from '@/components/payment-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, PartyPopper, SearchX, RefreshCcw, Leaf, PiggyBank } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

export default function HomePage() {
  const [searchResults, setSearchResults] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showBookingSuccessDialog, setShowBookingSuccessDialog] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [lastSearchCriteria, setLastSearchCriteria] = useState<HotelSearchCriteria | null>(null);
  const [totalSavings, setTotalSavings] = useState<number>(0);

  const { toast } = useToast();

  useEffect(() => {
    // Simulate fetching or calculating total savings
    // This runs client-side after hydration
    setTotalSavings(1234.56); // Mock value
  }, []);

  const handleSearch = async (criteria: HotelSearchCriteria) => {
    setIsLoading(true);
    setSearchPerformed(true);
    setLastSearchCriteria(criteria);
    try {
      const results = await searchHotels(criteria);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      toast({
        title: "Search Error",
        description: "Could not fetch hotel results. Please try again.",
        variant: "destructive",
      });
      setSearchResults([]);
    }
    setIsLoading(false);
  };

  const handleBookNow = (hotel: Hotel) => {
    if (!lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate) {
      toast({
        title: "Missing Dates",
        description: "Please select check-in and check-out dates to book.",
        variant: "destructive",
      });
      return;
    }
    setSelectedHotel(hotel);
    setShowPaymentDialog(true);
  };

  const handlePaymentSubmit = async (paymentDetails: PaymentDetails) => {
    if (!selectedHotel || !lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate || !lastSearchCriteria?.numberOfGuests) {
      toast({
        title: "Booking Error",
        description: "Missing booking information. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setIsBooking(true);
    try {
      const bookedTrip = await simulateBookHotel(
        selectedHotel,
        lastSearchCriteria.checkInDate,
        lastSearchCriteria.checkOutDate,
        lastSearchCriteria.numberOfGuests,
        paymentDetails
      );
      await addTrip(bookedTrip); // Save trip to localStorage
      setShowPaymentDialog(false);
      setShowBookingSuccessDialog(true);
      toast({
        title: "Booking Successful!",
        description: `${selectedHotel.name} has been booked.`,
      });
    } catch (error) {
      console.error("Booking failed:", error);
      toast({
        title: "Booking Failed",
        description: "Could not complete your booking. Please try again.",
        variant: "destructive",
      });
    }
    setIsBooking(false);
  };
  
  const calculateTotalAmount = () => {
    if (!selectedHotel || !lastSearchCriteria?.checkInDate || !lastSearchCriteria?.checkOutDate) return 0;
    const nights = Math.ceil((lastSearchCriteria.checkOutDate.getTime() - lastSearchCriteria.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    return nights * selectedHotel.pricePerNight * (lastSearchCriteria.numberOfGuests || 1);
  };


  return (
    <div className="container mx-auto py-8 px-4">
      <section className="text-center mb-12 hero-section py-16 bg-gradient-to-r from-primary/80 via-primary to-accent/70 rounded-lg shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
            <Image src="https://picsum.photos/seed/travelbg/1200/400" alt="Travel Background" layout="fill" objectFit="cover" data-ai-hint="landscape travel"/>
        </div>
        <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">Find Your Perfect Eco-Stay</h1>
            <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Discover sustainable hotels and unique accommodations that care for our planet.
            </p>
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-4">
             <HotelSearchForm onSearch={handleSearch} isLoading={isLoading} />
        </div>
      </section>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg">Finding amazing eco-stays for you...</p>
        </div>
      )}

      {!isLoading && searchPerformed && searchResults.length === 0 && (
         <div className="text-center py-10">
          <SearchX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-2xl font-semibold mb-2">No Hotels Found</h3>
          <p className="text-muted-foreground">We couldn't find any hotels matching your criteria. Try a different search?</p>
        </div>
      )}

      {!isLoading && searchResults.length > 0 && (
        <section>
          <h2 className="text-3xl font-semibold mb-8 text-center">
            Available Hotels in <span className="text-primary">{lastSearchCriteria?.city}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} onBook={handleBookNow} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && !searchPerformed && (
        <section className="py-16 space-y-16">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-semibold mb-6 text-primary">Why Choose ecoTrip.com?</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    We're committed to making your travel both sustainable and rewarding. Explore the unique benefits of booking with us.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1">
                    <Image src="https://picsum.photos/seed/rebook/600/400" alt="Eco Rebooking" width={600} height={400} className="mx-auto rounded-lg shadow-lg" data-ai-hint="savings money" />
                </div>
                <div className="order-1 md:order-2 text-center md:text-left">
                    <RefreshCcw className="h-12 w-12 text-accent mx-auto md:mx-0 mb-4" />
                    <h3 className="text-2xl font-semibold mb-3">Eco Rebooking: Save More, Effortlessly</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        Book with confidence! If the price of your booked hotel drops for the same room and dates, we'll automatically rebook it for you at the lower price. Saving money on your sustainable stays has never been easier.
                    </p>
                    <div className="mt-6 bg-primary/10 p-6 rounded-lg shadow-md">
                        <div className="flex items-center justify-center md:justify-start text-primary mb-2">
                            <PiggyBank className="h-10 w-10 mr-3" />
                            <span className="text-3xl font-bold">
                                {totalSavings !== null ? `$${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Loading...'}
                            </span>
                        </div>
                        <p className="text-center md:text-left text-sm text-muted-foreground font-medium">
                            Total saved by our users so far!
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="text-center md:text-left">
                     <Leaf className="h-12 w-12 text-accent mx-auto md:mx-0 mb-4" />
                    <h3 className="text-2xl font-semibold mb-3">Travel Green: Prioritizing Low-Emission Hotels</h3>
                    <p className="text-muted-foreground leading-relaxed">
                        We emphasize eco-friendly hotels that are actively working to reduce their carbon emissions and environmental impact. Make a positive choice for the planet by selecting accommodations that align with your sustainable values.
                    </p>
                </div>
                <div>
                    <Image src="https://picsum.photos/seed/ecohotel/600/400" alt="Eco-Friendly Hotel Focus" width={600} height={400} className="mx-auto rounded-lg shadow-lg" data-ai-hint="eco hotel" />
                </div>
            </div>
             <div className="text-center mt-16">
                <p className="text-lg text-muted-foreground">
                    Ready to explore? Use the search bar above to find your next sustainable adventure.
                </p>
            </div>
        </section>
      )}


      {selectedHotel && (
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Complete Your Booking</DialogTitle>
              <DialogDescription>
                You're about to book <span className="font-semibold">{selectedHotel.name}</span>. 
                Please provide payment details.
              </DialogDescription>
            </DialogHeader>
            <PaymentForm 
              onSubmit={handlePaymentSubmit} 
              isProcessing={isBooking}
              totalAmount={calculateTotalAmount()}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showBookingSuccessDialog} onOpenChange={setShowBookingSuccessDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <PartyPopper className="h-6 w-6 mr-2 text-primary" />
              Booking Successful!
            </DialogTitle>
            <DialogDescription>
              Your eco-trip to <span className="font-semibold">{selectedHotel?.name}</span> is confirmed. 
              Check your "My Trips" page for details.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" onClick={() => setShowBookingSuccessDialog(false)}>
                Great!
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

