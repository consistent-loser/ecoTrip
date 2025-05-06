
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
import { CreditCard, Lock, Wallet } from 'lucide-react';


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
              <FormLabel className="text-base font-medium">Payment Method</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-2 pt-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md hover:border-primary has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-all">
                    <FormControl>
                      <RadioGroupItem value="creditCard" id="creditCard"/>
                    </FormControl>
                    <FormLabel htmlFor="creditCard" className="font-normal flex items-center cursor-pointer w-full">
                        <CreditCard className="mr-3 h-5 w-5 text-accent" /> Credit Card
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md hover:border-primary has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-all">
                    <FormControl>
                      <RadioGroupItem value="debitCard" id="debitCard"/>
                    </FormControl>
                    <FormLabel htmlFor="debitCard" className="font-normal flex items-center cursor-pointer w-full">
                        <CreditCard className="mr-3 h-5 w-5 text-accent" /> Debit Card
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md hover:border-primary has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-all">
                    <FormControl>
                      <RadioGroupItem value="paypal" id="paypal"/>
                    </FormControl>
                    <FormLabel htmlFor="paypal" className="font-normal flex items-center cursor-pointer w-full">
                       <Wallet className="mr-3 h-5 w-5 text-accent" />
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
          <div className="space-y-4 p-4 border rounded-md bg-secondary/30">
            <FormField
              control={form.control}
              name="cardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Number</FormLabel>
                  <FormControl>
                    <Input placeholder="0000 0000 0000 0000" {...field} className="bg-background"/>
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
                      <Input placeholder="MM/YY" {...field} className="bg-background"/>
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
                      <Input placeholder="123" {...field} className="bg-background"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {paymentMethod === 'paypal' && (
          <div className="space-y-4 p-4 border rounded-md bg-secondary/30">
            <FormField
              control={form.control}
              name="paypalEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PayPal Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} className="bg-background"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        
        <div className="text-right font-semibold text-lg text-foreground">
          Total Amount: <span className="text-primary">${totalAmount.toFixed(2)}</span>
        </div>

        <Button type="submit" disabled={isProcessing} className="w-full text-lg py-6">
          <Lock className="mr-2 h-5 w-5" /> {isProcessing ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}`}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          This is a simulated payment. No real transaction will occur. Your data is safe.
        </p>
      </form>
    </Form>
  );
}
