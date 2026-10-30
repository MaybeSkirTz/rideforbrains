export async function digest(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  )
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
export const opaqueToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
async function key(secret: string) {
  if (!secret || secret.length < 32) throw new Error('Configuration de chiffrement absente');
  return crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('rideforbrains:guest-draft:v1:' + secret),
    ),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function seal(data: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(secret),
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) });
}
export async function unseal(data: string, secret: string) {
  const value = JSON.parse(data);
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(value.iv) },
        await key(secret),
        new Uint8Array(value.data),
      ),
    ),
  );
}
