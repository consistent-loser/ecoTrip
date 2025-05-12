
"use client";

import type { HotelSearchCriteria } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, Users, MapPin } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Updated schema: Make dates required for Amadeus search
const hotelSearchSchema = z.object({
  city: z.string().min(2, { message: 'City must be at least 2 characters.' }),
  checkInDate: z.date({
    required_error: "Check-in date is required.",
    invalid_type_error: "Invalid date format.",
  }),
  checkOutDate: z.date({
     required_error: "Check-out date is required.",
     invalid_type_error: "Invalid date format.",
  }),
  numberOfGuests: z.coerce
                    .number({ invalid_type_error: "Guests must be a number."})
                    .min(1, { message: 'At least 1 guest required.' })
                    .max(10, { message: 'Maximum 10 guests.' }),
}).refine(data => {
  // Ensure checkOutDate is strictly after checkInDate
  if (data.checkInDate && data.checkOutDate) {
    // Compare dates only (ignore time)
    const checkInDay = new Date(data.checkInDate.setHours(0,0,0,0));
    const checkOutDay = new Date(data.checkOutDate.setHours(0,0,0,0));
    return checkOutDay > checkInDay;
  }
  return true; // Let individual date validation handle missing dates
}, {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"], // Apply error to checkOutDate field
});

type HotelSearchFormValues = z.infer<typeof hotelSearchSchema>;

interface HotelSearchFormProps {
  onSearch: (criteria: HotelSearchCriteria) => void;
  isLoading?: boolean;
}

export function HotelSearchForm({ onSearch, isLoading = false }: HotelSearchFormProps) {
  const form = useForm<HotelSearchFormValues>({
    resolver: zodResolver(hotelSearchSchema),
    defaultValues: {
      city: '',
      numberOfGuests: 1,
      // Set default check-in/out dates? e.g., today and tomorrow
      // checkInDate: new Date(),
      // checkOutDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  function onSubmit(data: HotelSearchFormValues) {
    // Data types are guaranteed by Zod and useForm
    onSearch({
      city: data.city,
      checkInDate: data.checkInDate, // Now guaranteed to be a Date
      checkOutDate: data.checkOutDate, // Now guaranteed to be a Date
      numberOfGuests: data.numberOfGuests,
    });
  }

  return (
    <Form {...form}>
      {/* Removed spacing class 'gap-6' from form, added 'items-end' to grid */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 bg-secondary/50 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-4"> {/* Added mb-4 */}
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> Destination</FormLabel>
                <FormControl>
                  <Input placeholder="E.g., Paris, London" {...field} className="bg-background"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="checkInDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Check-in Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal bg-background",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } // Disable past dates
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="checkOutDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Check-out Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal bg-background",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                       disabled={(date) => {
                         const today = new Date(new Date().setHours(0,0,0,0));
                         const checkInDateValue = form.getValues("checkInDate");
                         const minDate = checkInDateValue ? new Date(new Date(checkInDateValue).getTime() + 24 * 60 * 60 * 1000) : new Date(today.getTime() + 24 * 60 * 60 * 1000);
                         minDate.setHours(0,0,0,0); // Ensure we compare dates only
                         return date < minDate;
                       }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numberOfGuests"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-primary" /> Guests</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" {...field} min="1" max="10" className="bg-background"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg"> {/* Removed self-center */}
          <Search className="mr-2 h-5 w-5" /> {isLoading ? 'Searching...' : 'Search Hotels'}
        </Button>
      </form>
    </Form>
  );
}
