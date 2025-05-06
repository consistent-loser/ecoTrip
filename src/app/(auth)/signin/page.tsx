
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Mail, Github, LogIn } from "lucide-react";

export default function SignInPage() {
  return (
    <Card className="w-full max-w-md shadow-xl border-border/60">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-3xl font-bold text-primary">Welcome Back!</CardTitle>
        <CardDescription className="text-muted-foreground">
          Sign in to manage your eco-trips and bookings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" type="email" placeholder="you@example.com" className="bg-background"/>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" className="bg-background"/>
        </div>
        <div className="flex items-center justify-end">
            <Link href="#" className="text-sm text-primary hover:underline font-medium">
                Forgot password?
            </Link>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 pt-2">
        <Button className="w-full text-base py-6">
            <LogIn className="mr-2 h-5 w-5" />
            Sign In
        </Button>
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/70" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full">
            <Button variant="outline" className="w-full py-5">
                <Mail className="mr-2 h-5 w-5 text-primary" /> Google
            </Button>
            <Button variant="outline" className="w-full py-5">
                <Github className="mr-2 h-5 w-5 text-primary" /> GitHub
            </Button>
        </div>
        <p className="pt-4 px-2 text-center text-xs text-muted-foreground">
          By clicking continue, you agree to our{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-primary font-medium"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-primary font-medium"
            >
            Privacy Policy
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
