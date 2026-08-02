import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/* ============================================================
   Stockage partagé des données "Missions en famille".
   Un seul bloc JSON stocké sous une clé Redis unique — c'est le
   remplaçant direct du window.storage de l'artifact d'origine.

   Les variables d'environnement acceptées (l'une ou l'autre paire) :
     - UPSTASH_REDIS_REST_URL   / UPSTASH_REDIS_REST_TOKEN
     - KV_REST_API_URL          / KV_REST_API_TOKEN
   ============================================================ */

const STORAGE_KEY = "missions-famille-v1";

// Toujours exécuter côté serveur, jamais de cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getRedis() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "Stockage non configuré (variables Upstash manquantes)." },
      { status: 503 }
    );
  }

  try {
    // @upstash/redis désérialise automatiquement le JSON stocké.
    const value = await redis.get(STORAGE_KEY);
    return NextResponse.json({ value: value ?? null });
  } catch (e) {
    console.error("Erreur lecture Redis", e);
    return NextResponse.json(
      { error: "Erreur de lecture du stockage." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "Stockage non configuré (variables Upstash manquantes)." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    await redis.set(STORAGE_KEY, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erreur écriture Redis", e);
    return NextResponse.json(
      { error: "Erreur d'écriture du stockage." },
      { status: 500 }
    );
  }
}
