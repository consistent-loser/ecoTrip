
"use client";

import type { HotelSearchCriteria, LocationSuggestion } from '@/types';
import { useState, useEffect, useCallback, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
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
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import { CalendarIcon, Search, Users, MapPin, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { suggestLocations } from '@/services/booking'; // Import the server action
import { Command, CommandItem, CommandList } from "@/components/ui/command"; // Use Command for list styling


// Updated schema: Make dates required for Amadeus search
// Allow city field to be just the name initially
const hotelSearchSchema = z.object({
  city: z.string().min(2, { message: 'Destination must be at least 2 characters.' }),
  cityCode: z.string().optional(), // Store IATA code separately
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
  if (data.checkInDate && data.checkOutDate) {
    const checkInDay = new Date(data.checkInDate.setHours(0,0,0,0));
    const checkOutDay = new Date(data.checkOutDate.setHours(0,0,0,0));
    return checkOutDay > checkInDay;
  }
  return true;
}, {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"],
});

type HotelSearchFormValues = z.infer<typeof hotelSearchSchema>;

interface HotelSearchFormProps {
  onSearch: (criteria: HotelSearchCriteria) => void;
  isLoading?: boolean;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function HotelSearchForm({ onSearch, isLoading = false }: HotelSearchFormProps) {
  const form = useForm<HotelSearchFormValues>({
    resolver: zodResolver(hotelSearchSchema),
    defaultValues: {
      city: '',
      cityCode: undefined,
      numberOfGuests: 1,
    },
  });

  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const cityInputValue = form.watch('city');
  const debouncedCityQuery = useDebounce(cityInputValue, 300); // Debounce input by 300ms
  const popoverOpenRef = useRef(false); // Ref to track popover state

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedCityQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setIsSuggestionsLoading(true);
      try {
        const results = await suggestLocations(debouncedCityQuery);
        setSuggestions(results);
        // Only show suggestions if input is focused and popover was intended to be open
        if (results.length > 0 && document.activeElement === form.control.getFieldRef('city') && popoverOpenRef.current) {
             setShowSuggestions(true);
        } else {
             setShowSuggestions(false);
        }

      } catch (error) {
        console.error("Failed to fetch location suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSuggestionsLoading(false);
      }
    };

    if (popoverOpenRef.current) { // Only fetch if popover is supposed to be open
         fetchSuggestions();
     } else {
         // If popover is closed, clear suggestions but keep loading state consistent
         setSuggestions([]);
         setShowSuggestions(false);
         // If the popover was closed *while* loading, stop the loading indicator
         if (isSuggestionsLoading) {
             setIsSuggestionsLoading(false);
         }
     }
  }, [debouncedCityQuery, form.control, isSuggestionsLoading]); // Added isSuggestionsLoading


  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    form.setValue('city', suggestion.name); // Update display name
    form.setValue('cityCode', suggestion.iataCode); // Store IATA code
    form.clearErrors('city'); // Clear validation error if any
    setSuggestions([]);
    setShowSuggestions(false);
    popoverOpenRef.current = false; // Explicitly close popover state
  };

  function onSubmit(data: HotelSearchFormValues) {
    // Use cityCode if available, otherwise pass the city name for potential lookup
    onSearch({
      city: data.city,
      cityCode: data.cityCode, // Pass the selected city code
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      numberOfGuests: data.numberOfGuests,
    });
    setShowSuggestions(false); // Hide suggestions on submit
    popoverOpenRef.current = false;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 bg-secondary/50 rounded-lg shadow relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start mb-4"> {/* Changed items-end to items-start */}

          {/* City Field with Popover for Suggestions */}
           <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> Destination</FormLabel>
                        <Popover
                            open={showSuggestions && popoverOpenRef.current} // Control popover visibility
                            onOpenChange={(open) => {
                                popoverOpenRef.current = open; // Update ref state
                                if (!open) {
                                    setShowSuggestions(false); // Hide suggestions when popover closes
                                } else if (field.value.length >= 2) {
                                    setShowSuggestions(true); // Show if condition met
                                }
                            }}
                        >
                            <PopoverAnchor asChild>
                                <FormControl>
                                    <div className="relative">
                                         <Input
                                            placeholder="E.g., Paris, London"
                                            {...field}
                                            className="bg-background pr-8" // Add padding for loader
                                            autoComplete="off" // Disable browser autocomplete
                                             onFocus={() => {
                                                 popoverOpenRef.current = true;
                                                  if(field.value.length >= 2 && suggestions.length > 0) setShowSuggestions(true);
                                             }}
                                             // onBlur={() => {
                                             //     // Delay hiding to allow click on suggestion
                                             //     setTimeout(() => {
                                             //        if (popoverOpenRef.current) { // Check ref before hiding
                                             //             setShowSuggestions(false);
                                             //              popoverOpenRef.current = false;
                                             //         }
                                             //     }, 150);
                                             // }}
                                        />
                                         {isSuggestionsLoading && (
                                            <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                        )}
                                    </div>
                                </FormControl>
                            </PopoverAnchor>
                           {/* Suggestions Popover Content */}
                           {showSuggestions && suggestions.length > 0 && (
                                <PopoverContent
                                    className="w-[--radix-popover-trigger-width] p-0" // Match input width
                                    onOpenAutoFocus={(e) => e.preventDefault()} // Prevent stealing focus
                                    align="start"
                                >
                                     <Command>
                                        <CommandList>
                                            {suggestions.map((suggestion) => (
                                            <CommandItem
                                                key={suggestion.id}
                                                value={suggestion.name}
                                                onSelect={() => handleSuggestionSelect(suggestion)}
                                                className="cursor-pointer"
                                            >
                                                {suggestion.name} ({suggestion.iataCode})
                                            </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            )}
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
            />

          {/* Check-in Date */}
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
                          "w-full justify-start text-left font-normal bg-background", // Changed pl-3 to justify-start
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" /> {/* Moved icon to left */}
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Check-out Date */}
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
                          "w-full justify-start text-left font-normal bg-background", // Changed pl-3 to justify-start
                          !field.value && "text-muted-foreground"
                        )}
                      >
                         <CalendarIcon className="mr-2 h-4 w-4" /> {/* Moved icon to left */}
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                         // Ensure checkOut is at least one day after checkIn, or tomorrow if checkIn not set
                         const minDate = checkInDateValue
                            ? new Date(new Date(checkInDateValue).getTime() + 24 * 60 * 60 * 1000)
                            : new Date(today.getTime() + 24 * 60 * 60 * 1000);
                         minDate.setHours(0,0,0,0);
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

          {/* Number of Guests */}
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
        {/* Submit Button */}
        <Button type="submit" disabled={isLoading || isSuggestionsLoading} className="w-full h-12 text-lg mt-2"> {/* Added mt-2 */}
          <Search className="mr-2 h-5 w-5" /> {isLoading ? 'Searching...' : 'Search Hotels'}
        </Button>
      </form>
    </Form>
  );
}
