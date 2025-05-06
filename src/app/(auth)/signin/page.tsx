import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc"; // Example, replace with lucide if preferred or an actual icon
import { FaGithub } from "react-icons/fa"; // Example

export default function SignInPage() {
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">Welcome Back!</CardTitle>
        <CardDescription>
          Sign in to manage your eco-trips and bookings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" />
        </div>
        <div className="flex items-center justify-between">
            <Link href="#" className="text-sm text-primary hover:underline">
                Forgot password?
            </Link>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button className="w-full">Sign In</Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full">
                <FcGoogle className="mr-2 h-4 w-4" /> Google
            </Button>
            <Button variant="outline" className="w-full">
                <FaGithub className="mr-2 h-4 w-4" /> GitHub
            </Button>
        </div>
        <p className="px-8 text-center text-sm text-muted-foreground">
          By clicking continue, you agree to our{" "}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-primary"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-primary"
            >
            Privacy Policy
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
