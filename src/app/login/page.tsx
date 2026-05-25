"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/pos");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-primary mb-1">Manolis</h1>
          <p className="text-lg text-outline">Fast, simple, reliable order taking</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm space-y-6"
        >
          {error && (
            <div className="bg-error-container text-error rounded-lg p-3 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-outline-variant rounded-lg px-3 py-3 text-base bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none min-h-[48px]"
              placeholder="admin@manolis.local"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-outline-variant rounded-lg px-3 py-3 text-base bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none min-h-[48px]"
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
