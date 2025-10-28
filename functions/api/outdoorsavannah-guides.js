// outdoorsavannah-guides.js
// Cloudflare Pages Function to validate token and serve PDFs from private R2 bucket
// Uses R2 bucket binding for secure, direct access to private storage
// Supports multiple guides via 'guide' query parameter

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');
    const guide = url.searchParams.get('guide') || 'cat-shelves'; // Default guide
    const forceDownload = url.searchParams.get('download') === '1'; // Force download if download=1

    if (!token || !email) {
      return new Response('Invalid access link', { status: 403 });
    }

    // Verify the token matches the email
    const expectedToken = await generateToken(email, env.GUIDE_SERVICE_TOKEN);

    if (token !== expectedToken) {
      return new Response('Invalid or expired access link', { status: 403 });
    }

    // Map guide names to R2 object keys (filenames in the bucket)
    const guideFiles = {
      'cat-shelves': 'Easy-Cat-Shelves.pdf',
      'cat-wall': 'Cat-Wall-Guide.pdf',
      // Add more guides here as needed
    };

    const filename = guideFiles[guide];

    if (!filename) {
      return new Response('Guide not found', { status: 404 });
    }

    // Check if this is a range request
    const range = request.headers.get('Range');

    // Access R2 bucket directly using the binding (private access)
    // The bucket binding is named 'guides_bucket' in Cloudflare Pages settings
    let object;

    if (range) {
      // Handle range request for streaming support
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : undefined;

        object = await env.guides_bucket.get(filename, {
          range: end ? { offset: start, length: end - start + 1 } : { offset: start }
        });
      } else {
        object = await env.guides_bucket.get(filename);
      }
    } else {
      object = await env.guides_bucket.get(filename);
    }

    if (!object) {
      console.error('PDF not found in R2:', filename);
      return new Response('Guide file not found', { status: 404 });
    }

    // Get the PDF as an ArrayBuffer
    const pdfBlob = await object.arrayBuffer();
    console.log('PDF size:', pdfBlob.byteLength, 'bytes');

    // Verify PDF magic number (PDFs start with %PDF) - only check on full requests
    if (!range) {
      const header = new Uint8Array(pdfBlob.slice(0, 5));
      const headerStr = String.fromCharCode(...header);
      console.log('PDF header:', headerStr);

      if (!headerStr.startsWith('%PDF')) {
        console.error('Invalid PDF - does not start with %PDF magic bytes');
        return new Response('Invalid PDF file in storage', { status: 500 });
      }
    }

    // Get content type from R2 object metadata or default to application/pdf
    const contentType = object.httpMetadata?.contentType || 'application/pdf';

    // Build response headers
    const headers = {
      'Content-Type': contentType,
      'Content-Disposition': forceDownload ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'ETag': object.httpEtag || ''
    };

    // Handle range response
    if (range && object.range) {
      headers['Content-Range'] = `bytes ${object.range.offset}-${object.range.offset + pdfBlob.byteLength - 1}/${object.size}`;
      headers['Content-Length'] = pdfBlob.byteLength.toString();

      return new Response(pdfBlob, {
        status: 206, // Partial Content
        headers
      });
    }

    // Full response
    headers['Content-Length'] = pdfBlob.byteLength.toString();

    return new Response(pdfBlob, {
      status: 200,
      headers
    });

  } catch (err) {
    console.error('Error in outdoorsavannah-guides:', err);
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
