"use client";

import type { PaymentDetails } from '@/types';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Lock } from 'lucide-react';
// Placeholder for PayPal and Debit Card icons if available or use generic
// For now, using CreditCard for all as placeholder or text
// import { Paypal } from 'lucide-react'; // Assuming Paypal icon exists or similar

const paymentSchema = z.object({
  method: z.enum(['creditCard', 'paypal', 'debitCard'], {
    required_error: "You need to select a payment method.",
  }),
  cardNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  cvc: z.string().optional(),
  paypalEmail: z.string().email({ message: "Invalid email address."}).optional(),
}).superRefine((data, ctx) => {
  if (data.method === 'creditCard' || data.method === 'debitCard') {
    if (!data.cardNumber || !/^\d{16}$/.test(data.cardNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid card number. Must be 16 digits.",
        path: ['cardNumber'],
      });
    }
    if (!data.expiryDate || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(data.expiryDate)) {
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid expiry date. Format MM/YY.",
        path: ['expiryDate'],
      });
    }
    if (!data.cvc || !/^\d{3,4}$/.test(data.cvc)) {
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid CVC. Must be 3 or 4 digits.",
        path: ['cvc'],
      });
    }
  }
  if (data.method === 'paypal' && !data.paypalEmail) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PayPal email is required.",
        path: ['paypalEmail'],
      });
  }
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  onSubmit: (details: PaymentDetails) => void;
  isProcessing?: boolean;
  totalAmount: number;
}

export function PaymentForm({ onSubmit, isProcessing = false, totalAmount }: PaymentFormProps) {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'creditCard',
    },
  });

  const paymentMethod = form.watch('method');

  function handleFormSubmit(data: PaymentFormValues) {
    onSubmit(data as PaymentDetails);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Payment Method</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="creditCard" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center"><CreditCard className="mr-2 h-5 w-5 text-accent" /> Credit Card</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="debitCard" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center"><CreditCard className="mr-2 h-5 w-5 text-accent" /> Debit Card</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="paypal" />
                    </FormControl>
                    {/* Replace with actual PayPal icon if available */}
                    <FormLabel className="font-normal flex items-center">
                       <svg className="mr-2 h-5 w-5 text-accent" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.3564 2.83496C9.40818 2.83496 7.73914 4.16549 7.22802 5.99676C7.22498 6.00922 7.22107 6.02183 7.21803 6.0337C5.00158 6.30361 3.35043 8.10476 3.35043 10.3943C3.35043 12.7614 5.15845 14.6351 7.45509 14.6351H8.00001V10.122H11.1811C13.8937 10.122 15.6194 8.65174 16.0119 6.39467C16.0341 6.2717 16.0438 6.15428 16.0438 6.04064C16.0438 4.24434 14.0495 2.83496 11.3564 2.83496ZM11.1941 12.9344H8.00001V15.3896H8.91854C9.28162 15.3896 9.57803 15.7467 9.57803 16.1136V17.6254H7.76908C7.72425 18.4002 7.7202 19.1287 7.76908 19.8183H9.57803V20.8809C9.57803 21.276 9.89628 21.5998 10.2914 21.5998H12.5839C14.8404 21.5998 16.5434 20.0059 16.8868 17.808C16.9153 17.6376 16.9296 17.4724 16.9296 17.3115C16.9296 14.9041 14.4044 12.9344 11.1941 12.9344ZM17.3079 10.3902C17.3079 10.4244 17.3079 10.4585 17.3079 10.4927V14.6351H17.8147C20.0263 14.6351 21.6595 12.8362 21.6595 10.5638C21.6595 8.39105 20.1912 6.60662 18.0751 6.24109C18.0552 6.23687 18.0346 6.23137 18.0145 6.22694C18.3911 6.03242 18.6355 5.63653 18.6355 5.19135C18.6355 4.48132 18.0751 3.90503 17.3506 3.90503C16.6538 3.90503 16.1013 4.45691 16.0697 5.13178L16.0611 5.13178C16.0611 5.13178 16.0611 5.13178 16.0611 5.13178C15.8886 5.13178 15.7438 5.20164 15.7214 5.35223C15.7214 5.35223 15.7214 5.35223 15.7214 5.35223C15.6787 5.65772 15.7782 5.95898 16.0027 6.13745L16.0027 6.13745L16.0027 6.13745C16.0027 6.13745 16.0027 6.13745 16.0027 6.13745L17.3079 10.3902Z" /></svg>
                      PayPal
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {(paymentMethod === 'creditCard' || paymentMethod === 'debitCard') && (
          <>
            <FormField
              control={form.control}
              name="cardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Number</FormLabel>
                  <FormControl>
                    <Input placeholder="0000 0000 0000 0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input placeholder="MM/YY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cvc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVC</FormLabel>
                    <FormControl>
                      <Input placeholder="123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}

        {paymentMethod === 'paypal' && (
          <FormField
            control={form.control}
            name="paypalEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PayPal Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <div className="text-right font-semibold text-lg">
          Total: ${totalAmount.toFixed(2)}
        </div>

        <Button type="submit" disabled={isProcessing} className="w-full">
          <Lock className="mr-2 h-4 w-4" /> {isProcessing ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}`}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          This is a simulated payment. No real transaction will occur.
        </p>
      </form>
    </Form>
  );
}
