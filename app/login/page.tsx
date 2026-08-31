"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"form" | "enviando" | "enviado">("form");
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEstado("enviando");

    const supabase = createClient();
    const { data: habilitado } = await supabase.rpc("email_habilitado", {
      e: email.trim(),
    });

    if (!habilitado) {
      setError("Ese email no está habilitado para entrar.");
      setEstado("form");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setEstado("form");
      return;
    }
    setEstado("enviado");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5">
      <h1 className="text-3xl font-semibold">Nuestro casamiento</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Entrá con tu email y te mandamos un link de acceso.
      </p>

      {estado === "enviado" ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-medium">Listo, revisá tu correo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Te mandamos un link a {email}. Abrilo desde este mismo celular.
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setEstado("form")}
          >
            Usar otro email
          </Button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="tu@email.com"
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={estado === "enviando"}
          >
            {estado === "enviando" ? "Enviando…" : "Enviarme el link"}
          </Button>
        </form>
      )}
    </main>
  );
}
