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
import { CalendarIcon, Search, Users, MapPin, Loader2, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { suggestLocations } from '@/services/booking'; // Import the server action
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandGroup } from "@/components/ui/command"; // Use Command for list styling
import { useToast } from "@/hooks/use-toast";


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
      // Initialize dates slightly in the future for better UX
      checkInDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      checkOutDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    },
  });

  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null); // Add state for suggestion errors
  const cityInputValue = form.watch('city');
  const debouncedCityQuery = useDebounce(cityInputValue, 300); // Debounce input by 300ms
  const popoverOpenRef = useRef(false); // Ref to track popover state intention
  const inputRef = useRef<HTMLInputElement>(null); // Ref for the input element
  const { toast } = useToast();

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedCityQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        setSuggestionError(null);
        return;
      }

       // Only fetch if the input field is currently focused or popover intended to be open
      if (!popoverOpenRef.current && document.activeElement !== inputRef.current) {
        setShowSuggestions(false);
        return;
      }


      console.log(`Fetching suggestions for: ${debouncedCityQuery}`);
      setIsSuggestionsLoading(true);
      setSuggestionError(null); // Clear previous errors
      setShowSuggestions(true); // Intend to show suggestions now

      try {
        const results = await suggestLocations(debouncedCityQuery);
        console.log('Suggestions received:', results);
         if (!popoverOpenRef.current && document.activeElement !== inputRef.current) {
            // If focus lost or popover closed while fetching, don't update state
             console.log("Focus lost or popover closed during fetch, discarding results.");
             setShowSuggestions(false);
         } else {
             setSuggestions(results);
             setSuggestionError(results.length === 0 ? "No matching locations found." : null);
             // Keep showing suggestions if there are results or a "not found" message
             setShowSuggestions(true);
         }

      } catch (error: any) {
        console.error("Failed to fetch location suggestions:", error);
        const errorMessage = error.message || "Could not fetch locations.";
        setSuggestionError(errorMessage);
         toast({
            title: "Location Suggestion Error",
            description: errorMessage,
            variant: "destructive",
            duration: 3000,
        });
        setSuggestions([]);
         // Keep popover open to show the error message
        setShowSuggestions(true);
      } finally {
        // Only stop loading if the popover is still supposed to be open
         if (popoverOpenRef.current || document.activeElement === inputRef.current) {
             setIsSuggestionsLoading(false);
         } else {
            // If popover closed/focus lost, ensure loading is false but don't reshow suggestions
             setIsSuggestionsLoading(false);
             setShowSuggestions(false);
         }
      }
    };

    fetchSuggestions();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCityQuery, toast]); // Only trigger on debounced query change


  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    console.log('Suggestion selected:', suggestion);
    form.setValue('city', suggestion.name); // Update display name
    form.setValue('cityCode', suggestion.iataCode); // Store IATA code
    form.clearErrors('city'); // Clear validation error if any
    setSuggestions([]);
    setShowSuggestions(false);
    popoverOpenRef.current = false; // Explicitly close popover state
    inputRef.current?.blur(); // Optionally blur input after selection
  };

  function onSubmit(data: HotelSearchFormValues) {
     console.log('Form submitted with data:', data);
     // Ensure cityCode is included if available
    if (!data.cityCode && suggestions.length > 0) {
       // Attempt to find code if user submitted without explicit selection
       const potentialMatch = suggestions.find(s => s.name.toLowerCase() === data.city.toLowerCase());
       if (potentialMatch) {
           data.cityCode = potentialMatch.iataCode;
           console.log(`Automatically used cityCode ${data.cityCode} based on input match.`);
       } else {
           console.warn(`No matching suggestion found for city "${data.city}", submitting without cityCode.`);
            toast({
                title: "Location Ambiguous",
                description: `Could not auto-select a location code for "${data.city}". Search might be less accurate. Try selecting from the suggestions.`,
                variant: "default", // Use default or a warning variant
                 duration: 5000,
            });
       }
     } else if (!data.cityCode) {
         console.warn(`Submitting without cityCode for city "${data.city}".`);
         // Optional: Show a toast if submitting without a code when suggestions weren't even available
     }


    onSearch({
      city: data.city,
      cityCode: data.cityCode, // Pass the selected or potentially derived city code
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      numberOfGuests: data.numberOfGuests,
    });
    setShowSuggestions(false); // Hide suggestions on submit
    popoverOpenRef.current = false;
  }

  const handleOpenChange = (open: boolean) => {
        popoverOpenRef.current = open;
        if (!open) {
            setShowSuggestions(false);
            // Slight delay on blur to allow click selection
            setTimeout(() => {
                 if (!popoverOpenRef.current) { // Double check if it was reopened quickly
                    setShowSuggestions(false);
                 }
            }, 150);
        } else if (cityInputValue.length >= 2) {
             // If opening manually, ensure suggestions are shown if input is long enough
             setShowSuggestions(true);
             // Trigger fetch if needed (debounced useEffect will handle it)
        } else {
             setShowSuggestions(false); // Don't show if input too short
        }
    };

   const handleInputFocus = () => {
       console.log("Input focused");
       popoverOpenRef.current = true; // Mark intention to open
       if (cityInputValue.length >= 2 && (suggestions.length > 0 || suggestionError)) {
           setShowSuggestions(true); // Show existing suggestions or error on focus
       }
   };

   const handleInputBlur = () => {
        console.log("Input blurred");
       // Don't immediately hide suggestions on blur, Popover's onOpenChange handles it
       // This allows clicking on the suggestion list without it disappearing instantly.
       // popoverOpenRef.current = false; // Mark intention to close (handled by onOpenChange)
   };


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
                            open={showSuggestions} // Control popover visibility directly
                            onOpenChange={handleOpenChange}
                        >
                            <PopoverAnchor asChild>
                                <FormControl>
                                    <div className="relative">
                                         <Input
                                            placeholder="E.g., Paris, London"
                                            {...field}
                                            ref={inputRef} // Attach ref
                                            className="bg-background pr-8" // Add padding for loader
                                            autoComplete="off" // Disable browser autocomplete
                                            onFocus={handleInputFocus}
                                            onBlur={handleInputBlur}
                                            aria-autocomplete="list"
                                            aria-controls="location-suggestions"
                                        />
                                         {isSuggestionsLoading && (
                                            <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                        )}
                                    </div>
                                </FormControl>
                            </PopoverAnchor>
                           {/* Suggestions Popover Content */}
                               <PopoverContent
                                    id="location-suggestions"
                                    className="w-[--radix-popover-trigger-width] p-0" // Match input width
                                    style={{ marginTop: '0.25rem' }} // Add small top margin
                                    onOpenAutoFocus={(e) => e.preventDefault()} // Prevent stealing focus
                                    onCloseAutoFocus={(e) => e.preventDefault()} // Prevent returning focus to trigger
                                    align="start"
                                >
                                     <Command shouldFilter={false}> {/* Disable CMDK filtering, rely on API */}
                                        <CommandList>
                                             {isSuggestionsLoading && suggestions.length === 0 && !suggestionError && (
                                                 <div className="p-4 text-sm text-center text-muted-foreground">Loading...</div>
                                             )}
                                             {!isSuggestionsLoading && suggestionError && (
                                                  <div className="p-4 text-sm text-center text-destructive flex items-center justify-center">
                                                      <AlertCircle className="h-4 w-4 mr-2" /> {suggestionError}
                                                  </div>
                                             )}
                                             {!isSuggestionsLoading && !suggestionError && suggestions.length > 0 && (
                                                suggestions.map((suggestion) => (
                                                    <CommandItem
                                                        key={suggestion.id}
                                                        value={suggestion.name} // Use name for potential filtering if enabled
                                                        onSelect={() => handleSuggestionSelect(suggestion)}
                                                        className="cursor-pointer"
                                                    >
                                                        {suggestion.name} {suggestion.iataCode ? `(${suggestion.iataCode})` : ''}
                                                    </CommandItem>
                                                ))
                                             )}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
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
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } // Disable past dates
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
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" /> }
          {isLoading ? 'Searching...' : 'Search Hotels'}
        </Button>
      </form>
    </Form>
  );
}
