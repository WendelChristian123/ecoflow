import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * push-notify Edge Function
 * 
 * Sends Web Push notifications to a user's registered devices.
 * Uses VAPID authentication and the Web Push Protocol directly.
 * 
 * Called internally by push-cron or other Edge Functions.
 * Requires service_role key (no user auth needed).
 * 
 * Body: { user_id, title, body, data: { type, id, url, tag } }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Web Push Crypto Utilities ---

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64Url: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64Url);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    convertRawToP256Pkcs8(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw (r || s)
  const rawSig = derToRaw(new Uint8Array(signature));
  const signatureB64 = uint8ArrayToBase64Url(rawSig);

  return `${unsignedToken}.${signatureB64}`;
}

// Convert raw EC private key (32 bytes) to PKCS8 DER format
function convertRawToP256Pkcs8(rawKey: Uint8Array): ArrayBuffer {
  // PKCS8 header for P-256 EC key
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  // Suffix: public key padding (we omit public key)
  const suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  // For PKCS8 without public key, we just need header + raw private key
  const result = new Uint8Array(header.length + rawKey.length);
  result.set(header);
  result.set(rawKey, header.length);
  return result.buffer;
}

// Convert DER encoded ECDSA signature to raw format (r || s, each 32 bytes)
function derToRaw(der: Uint8Array): Uint8Array {
  // If the signature is already 64 bytes, it's already raw
  if (der.length === 64) return der;

  const raw = new Uint8Array(64);
  // Parse DER: 0x30 <len> 0x02 <r_len> <r> 0x02 <s_len> <s>
  let offset = 2; // skip 0x30 <len>
  // R
  offset++; // skip 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  // S
  offset++; // skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen > 32 ? 32 : 64 - sLen;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

// --- Simplified Push Send (no payload encryption for now — use fetch with VAPID) ---

async function sendWebPush(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; status: number; statusText: string }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await generateVapidJwt(audience, vapidSubject, vapidPrivateKey);

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

  // For Web Push with encryption, we need to do ECDH + HKDF + content encoding.
  // This is complex. Instead, we use a simpler approach: send a fetch to the push
  // endpoint with the VAPID header and encrypted payload.
  
  // Actually, Web Push REQUIRES payload encryption (RFC 8291).
  // Let's implement a proper encrypted push.

  const encrypted = await encryptPayload(
    payloadBytes,
    base64UrlToUint8Array(subscription.keys_p256dh),
    base64UrlToUint8Array(subscription.keys_auth)
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Urgency": "high", // Required for Heads-Up / Pop-up notifications on Android
      "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Length": String(encrypted.byteLength),
    },
    body: encrypted,
  });

  return {
    success: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
  };
}

// --- AES128GCM Content Encryption (RFC 8291) ---

async function encryptPayload(
  plaintext: Uint8Array,
  clientPublicKey: Uint8Array,
  clientAuthSecret: Uint8Array
): Promise<ArrayBuffer> {
  // Generate server ECDH keypair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    serverKeyPair.privateKey,
    256
  );

  // Export server public key (raw, uncompressed)
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  // Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const encoder = new TextEncoder();

  // IKM via HKDF: HKDF-Extract(auth_secret, ecdh_secret)
  const authInfo = encoder.encode("WebPush: info\0");
  const ikm_info = new Uint8Array(authInfo.length + clientPublicKey.length + serverPublicKeyRaw.length);
  ikm_info.set(authInfo);
  ikm_info.set(clientPublicKey, authInfo.length);
  ikm_info.set(serverPublicKeyRaw, authInfo.length + clientPublicKey.length);

  const prk_key = await crypto.subtle.importKey(
    "raw",
    clientAuthSecret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", prk_key, sharedSecret));

  const ikm = await hkdfExpand(prk, ikm_info, 32);

  // PRK for content encryption
  const cek_info = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonce_info = encoder.encode("Content-Encoding: nonce\0");

  const salt_key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk2 = new Uint8Array(await crypto.subtle.sign("HMAC", salt_key, ikm));

  const cek = await hkdfExpand(prk2, cek_info, 16);
  const nonce = await hkdfExpand(prk2, nonce_info, 12);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding delimiter (0x02 for final record)
  const paddedPlaintext = new Uint8Array(plaintext.length + 1);
  paddedPlaintext.set(plaintext);
  paddedPlaintext[plaintext.length] = 2; // Final record padding

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      aesKey,
      paddedPlaintext
    )
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyRaw.length);
  header.set(salt);
  const rsView = new DataView(header.buffer, 16, 4);
  rsView.setUint32(0, rs);
  header[20] = serverPublicKeyRaw.length;
  header.set(serverPublicKeyRaw, 21);

  // Combine header + ciphertext
  const result = new Uint8Array(header.length + ciphertext.length);
  result.set(header);
  result.set(ciphertext, header.length);

  return result.buffer;
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const input = new Uint8Array(info.length + 1);
  input.set(info);
  input[info.length] = 1; // Counter
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, input));
  return output.slice(0, length);
}

// --- Main Handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, title, body: notifBody, data } = body;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "Missing user_id or title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contazze@contazze.com";

    // Get all subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError || !subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = { title, body: notifBody, data };
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const result = await sendWebPush(
          sub,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (result.success) {
          sent++;
        } else if (result.status === 410 || result.status === 404) {
          // Subscription expired — mark for removal
          expiredEndpoints.push(sub.endpoint);
          failed++;
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${result.status} ${result.statusText}`);
          failed++;
        }
      } catch (err) {
        console.error(`Push error for ${sub.endpoint}:`, err);
        failed++;
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      console.log(`Removed ${expiredEndpoints.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({ sent, failed, expired: expiredEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("push-notify error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
