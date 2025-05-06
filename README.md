# ecoTrip.com

This is a Next.js application for ecoTrip.com, a platform for finding and booking sustainable travel accommodations.

## Core Features

- **Hotel Search**: Allows users to search for hotels based on city, dates, and number of guests.
- **Simulated Booking**: Simulates the hotel booking process.
- **Payment Simulation**: Provides UI for various payment methods (Credit Card, PayPal, Debit Card) without actual transactions.
- **Trips Page**: Displays upcoming and past booked trips.
- **Calendar Filter**: Integrated into the search form for selecting dates.

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- ShadCN UI Components
- Lucide React (Icons)

## Project Structure

- `src/app/`: Main application routes and pages.
  - `page.tsx`: Homepage with hotel search.
  - `trips/page.tsx`: My Trips page.
  - `(auth)/`: Group for authentication-related pages.
    - `signin/page.tsx`: Sign-in page.
- `src/components/`: Reusable UI components.
  - `layout/`: Layout components like Header and Footer.
  - `ui/`: ShadCN UI components.
  - Other specific components like `HotelSearchForm.tsx`, `HotelCard.tsx`, etc.
- `src/services/`: Mock API service for booking and hotel data (`booking.ts`).
- `src/types/`: TypeScript type definitions (`index.ts`).
- `src/lib/`: Utility functions (`utils.ts`).
- `src/hooks/`: Custom React hooks (`use-toast.ts`, `use-mobile.tsx`).
- `public/`: Static assets.
- `src/app/globals.css`: Global styles and Tailwind CSS setup.
- `tailwind.config.ts`: Tailwind CSS configuration.
- `next.config.ts`: Next.js configuration.

## Styling

The application uses Tailwind CSS for styling, with a custom theme defined in `src/app/globals.css` and `tailwind.config.ts`.
The color scheme is:
- Primary: Green (#4CAF50)
- Secondary: Light Gray (#F5F5F5)
- Accent: Teal (#008080)

Fonts are managed via `next/font`.
