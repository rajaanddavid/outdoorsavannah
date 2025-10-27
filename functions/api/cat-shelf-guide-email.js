// cat-shelf-guide-email.js
// Cloudflare Pages Function to send cat-shelf-guide via AWS SES

// --------------------
// Helper functions
// --------------------

// Hash a string using SHA-256
async function hash(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
              .map(b => b.toString(16).padStart(2, "0"))
              .join("");
}

// HMAC with SHA-256
async function hmac(key, str) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(str)
  );
  return new Uint8Array(signature);
}

// Convert ArrayBuffer/Uint8Array to hex string
function toHex(arrayBuffer) {
  return Array.from(arrayBuffer)
              .map(b => b.toString(16).padStart(2, "0"))
              .join("");
}

// Generate signing key for AWS Signature v4
async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const encoder = new TextEncoder();
  let kDate = await hmac(encoder.encode("AWS4" + key), dateStamp);
  let kRegion = await hmac(kDate, regionName);
  let kService = await hmac(kRegion, serviceName);
  let kSigning = await hmac(kService, "aws4_request");
  return kSigning;
}

// Sign request using AWS Signature v4
async function signAWSv4({ method, url, region, service, body, accessKeyId, secretKey }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname;
  const canonicalQuerystring = "";

  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";

  const payloadHash = await hash(body);
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await hash(canonicalRequest)}`;

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    "Authorization": authorizationHeader,
    "X-Amz-Date": amzDate
  };
}

// --------------------
// Main function
// --------------------
export async function onRequestPost({ request, env }) {
  try {
    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // --- 1. Log email to database ---
    // Example using D1 (SQLite) or KV:
    // Replace with your own database logic
    if (env.DB) {
      try {
        // If using D1 (Pages D1)
        await env.DB.prepare(`INSERT OR IGNORE INTO cat_shelf_guide (email) VALUES (?)`)
                    .bind(email)
                    .run();
      } catch (dbErr) {
        console.error("Database error:", dbErr);
      }
    }

    // --- 2. Send email using SES ---
    const region = "us-east-2"; // SES region
    const accessKeyId = env.AWS_ACCESS_KEY_ID;
    const secretKey = env.AWS_SECRET_ACCESS_KEY;
    const from = "david@outdoorsavannah.com";
    const to = email;
    const guideUrl = env.CAT_SHELF_GUIDE_URL;

    const endpoint = `https://email.${region}.amazonaws.com/`;

    // Construct SES API parameters
    const params = new URLSearchParams({
      Action: "SendEmail",
      Source: from,
      "Destination.ToAddresses.member.1": to,
      "Message.Subject.Data": "😸 Your Cat Shelf Guide!",

        // Plain text version (for older email clients)
      "Message.Body.Text.Data": `Thanks for joining.
    I hope this inspires you to build your own cat friendly space!
    Cat Shelf Guide on Google Drive: ${env.CAT_SHELF_GUIDE_URL}`,

      // HTML version
      "Message.Body.Html.Data": `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Your Cat Shelf Guide!</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f5f6fa;
            margin: 0;
            padding: 0;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .header {
            background: #0069ff;
            height: 12px;
          }
          .content {
            padding: 40px 30px;
            text-align: center;
          }
          h1 {
            color: #1d1d1f;
            font-size: 28px;
            margin-bottom: 8px;
          }
          p {
            font-size: 16px;
            color: #555;
            margin-bottom: 28px;
            line-height: 1.5;
          }
          .image {
            margin-bottom: 24px;
          }
          .button {
            display: inline-block;
            background: #0069ff;
            color: #fff !important;
            text-decoration: none;
            font-weight: 600;
            padding: 14px 24px;
            border-radius: 999px;
            font-size: 16px;
          }
          .footer {
            background: #f5f6fa;
            text-align: center;
            padding: 20px;
            font-size: 13px;
            color: #777;
          }
          .footer a {
            color: #555;
            text-decoration: none;
            font-weight: 600;
          }
          .unsubscribe {
            margin-top: 8px;
            display: block;
            color: #888;
            text-decoration: underline;
            font-size: 13px;
          }
        </style>
        </head>
        <body>
          <div class="container">
            <div class="header"></div>
            <div class="content">
              <h1>Thanks for Joining</h1>
              <p>I hope this inspires you to build your own cat friendly space!</p>

              <div class="image">
                <img src="https://example.com/path/to/your-image.jpg" alt="Cat Shelf Guide" width="100%" style="border-radius:8px;max-width:520px;">
              </div>

              <a href="${guideUrl}" class="button">Cat Shelf Guide on Google Drive</a>
            </div>

            <div class="footer">
              <a href="https://www.outdoorsavannah.com/">OutdoorSavannah.com</a>
              <a href="https://www.outdoorsavannah.com/unsubscribe/" class="unsubscribe">Unsubscribe</a>
              <p style="margin-top:12px;">OutdoorSavannah, 2000 County Rd B2 W #131903, St. Paul, MN, 55113</p>
            </div>
          </div>
        </body>
      </html>
      `
    });

    // Generate signed headers
    const signedHeaders = await signAWSv4({
      method: "POST",
      url: endpoint,
      region,
      service: "ses",
      body: params.toString(),
      accessKeyId,
      secretKey
    });

    // Send the request
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...signedHeaders
      },
      body: params.toString()
    });

    if (response.ok) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const text = await response.text();
      console.error(text);
      return new Response(JSON.stringify({ success: false, error: text }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
