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

const hotelSearchSchema = z.object({
  city: z.string().min(2, { message: 'City must be at least 2 characters.' }),
  checkInDate: z.date().optional(),
  checkOutDate: z.date().optional(),
  numberOfGuests: z.coerce.number().min(1, { message: 'At least 1 guest required.' }).max(10, { message: 'Maximum 10 guests.' }),
}).refine(data => {
  if (data.checkInDate && data.checkOutDate) {
    return data.checkOutDate > data.checkInDate;
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

export function HotelSearchForm({ onSearch, isLoading = false }: HotelSearchFormProps) {
  const form = useForm<HotelSearchFormValues>({
    resolver: zodResolver(hotelSearchSchema),
    defaultValues: {
      city: '',
      numberOfGuests: 1,
    },
  });

  function onSubmit(data: HotelSearchFormValues) {
    onSearch(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-6 bg-secondary/50 rounded-lg shadow">
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-primary" /> Destination</FormLabel>
              <FormControl>
                <Input placeholder="E.g., Greenville, Metro City" {...field} className="bg-background"/>
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
                    disabled={(date) => 
                      date < (form.getValues("checkInDate") || new Date(new Date().setHours(0,0,0,0)))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="numberOfGuests"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-primary" /> Guests</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" {...field} className="bg-background"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading} className="w-full self-end h-10">
            <Search className="mr-2 h-4 w-4" /> {isLoading ? 'Searching...' : 'Search Hotels'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
