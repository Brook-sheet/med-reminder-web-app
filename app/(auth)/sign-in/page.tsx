"use client";

import React, { useState } from "react";
import {
  Card, CardHeader, CardDescription, CardContent, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const Signin = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }

      // Redirect to dashboard on success
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-gray-800">
      <Card className="md:h-auto w-[80%] sm:w-[420px] p-4 sm:p-8">
        <CardHeader>
          <CardTitle className="text-center">Login</CardTitle>
          <CardDescription className="text-sm text-center text-accent-foreground">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              disabled={loading}
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              disabled={loading}
            />
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <Separator className="my-4" />

          <p className="text-sm text-center text-muted-foreground mt-2">
            Create new account?{" "}
            <a href="/sign-up" className="text-blue-500 hover:underline cursor-pointer">
              Sign Up
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signin;

