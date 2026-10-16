"use client";
import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function Sair() {
  const { signOut } = useClerk();
  useEffect(() => { signOut({ redirectUrl: "/" }); }, [signOut]);
  return <p className="muted" style={{ padding: 24 }}>Saindo…</p>;
}
