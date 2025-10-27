// guide-access.js
// Cloudflare Pages Function to validate token and redirect to R2 bucket
// Supports multiple guides via 'guide' query parameter

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');
    const guide = url.searchParams.get('guide') || 'cat-shelves'; // Default guide

    if (!token || !email) {
      return new Response('Invalid access link', { status: 403 });
    }

    // Verify the token matches the email
    const expectedToken = await generateToken(email, env.JWT_SECRET);

    if (token !== expectedToken) {
      return new Response('Invalid or expired access link', { status: 403 });
    }

    // Map guide names to R2 URLs
    const guideUrls = {
      'cat-shelves': 'https://cdn.outdoorsavannah.com/Easy-Cat-Shelves.pdf',
      // Add more guides here as needed
    };

    const r2Url = guideUrls[guide];

    if (!r2Url) {
      return new Response('Guide not found', { status: 404 });
    }

    // Redirect to the R2 bucket with Cloudflare Access
    return Response.redirect(r2Url, 302);

  } catch (err) {
    console.error(err);
    return new Response('Access error', { status: 500 });
  }
}

// Generate a simple token based on email and secret
async function generateToken(email, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email + secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32); // Use first 32 chars as token
}
