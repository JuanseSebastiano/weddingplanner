"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"codigo" | "password">("codigo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function entrarOk() {
    router.replace("/");
    router.refresh();
  }

  async function entrarConPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError("Email o contraseña incorrectos.");
      setEnviando(false);
      return;
    }
    entrarOk();
  }

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    // Sin registro público: solo entran los usuarios ya creados.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    setEnviando(false);
    if (error) {
      setError("No pudimos mandar el código. Revisá el email o esperá un minuto.");
      return;
    }
    setCodigoEnviado(true);
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: codigo.trim(),
      type: "email",
    });

    if (error) {
      setError("Código incorrecto o vencido.");
      setEnviando(false);
      return;
    }
    entrarOk();
  }

  const campoEmail = (
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
        placeholder="tu@gmail.com"
        className="mt-1"
      />
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5">
      <h1 className="font-serif text-4xl font-normal leading-tight">Nosotros</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Boda, finanzas y viaje en un solo lugar.
      </p>

      {modo === "password" ? (
        <form onSubmit={entrarConPassword} className="space-y-3">
          {campoEmail}
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      ) : !codigoEnviado ? (
        <form onSubmit={pedirCodigo} className="space-y-3">
          {campoEmail}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            {enviando ? "Enviando…" : "Mandarme un código"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verificarCodigo} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Te mandamos un código a <strong>{email.trim()}</strong>. Si no
            llega, revisá spam.
          </p>
          <div>
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={codigo}
              onChange={(ev) => setCodigo(ev.target.value)}
              className="mt-1 tracking-widest"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            {enviando ? "Verificando…" : "Entrar"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setCodigoEnviado(false);
              setCodigo("");
              setError(null);
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Cambiar email o pedir otro código
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setModo(modo === "codigo" ? "password" : "codigo");
          setCodigoEnviado(false);
          setError(null);
        }}
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
      >
        {modo === "codigo" ? "Entrar con contraseña" : "Entrar con un código por mail"}
      </button>
    </main>
  );
}
