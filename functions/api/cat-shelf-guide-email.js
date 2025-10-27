// cat-shelf-guide-email.js
// Cloudflare Pages Function to send cat-shelf-guide via AWS SES

// --------------------
// Helper functions
// --------------------

// Generate access token URL (uses guide-access.js endpoint)
async function generateAccessUrl(userEmail, jwtSecret, guideName = 'cat-shelves') {
  // Generate a simple token based on email and secret
  const encoder = new TextEncoder();
  const data = encoder.encode(userEmail + jwtSecret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const token = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32); // Use first 32 chars as token

  // Return URL to our guide-access endpoint which validates and redirects
  return `https://outdoorsavannah.com/api/guide-access?email=${encodeURIComponent(userEmail)}&token=${token}&guide=${guideName}`;
}

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

// Rate limiting helper
async function checkRateLimit(email, ip, env) {
  if (!env.KV) return true; // Skip if KV not configured

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  // Rate limit by email: 3 requests per hour, 5 per day
  const emailKey = `rate_limit_email:${email}`;
  const emailData = await env.KV.get(emailKey, { type: "json" });

  if (emailData) {
    const hourAgo = now - oneHour;
    const dayAgo = now - oneDay;

    const recentRequests = emailData.requests.filter(t => t > hourAgo);
    const dailyRequests = emailData.requests.filter(t => t > dayAgo);

    if (recentRequests.length >= 3) {
      return { blocked: true, reason: "Too many requests from this email. Please try again in 1 hour." };
    }
    if (dailyRequests.length >= 5) {
      return { blocked: true, reason: "Daily limit reached for this email. Please try again tomorrow." };
    }

    emailData.requests.push(now);
    await env.KV.put(emailKey, JSON.stringify(emailData), { expirationTtl: 86400 }); // 24h expiry
  } else {
    await env.KV.put(emailKey, JSON.stringify({ requests: [now] }), { expirationTtl: 86400 });
  }

  // Rate limit by IP: 10 requests per hour (prevents mass spam from one source)
  const ipKey = `rate_limit_ip:${ip}`;
  const ipData = await env.KV.get(ipKey, { type: "json" });

  if (ipData) {
    const hourAgo = now - oneHour;
    const recentRequests = ipData.requests.filter(t => t > hourAgo);

    if (recentRequests.length >= 10) {
      return { blocked: true, reason: "Too many requests from your network. Please try again later." };
    }

    ipData.requests.push(now);
    await env.KV.put(ipKey, JSON.stringify(ipData), { expirationTtl: 3600 }); // 1h expiry
  } else {
    await env.KV.put(ipKey, JSON.stringify({ requests: [now] }), { expirationTtl: 3600 });
  }

  return { blocked: false };
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

    // --- Rate limiting check ---
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const rateLimitCheck = await checkRateLimit(email, clientIP, env);

    if (rateLimitCheck.blocked) {
      return new Response(JSON.stringify({
        success: false,
        error: rateLimitCheck.reason
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "3600" // 1 hour
        }
      });
    }

    // --- 1. Handle subscription in database ---
    if (env.DB) {
      try {
        // Check if email already exists
        const existing = await env.DB.prepare(`SELECT email, unsubscribed FROM cat_shelf_guide WHERE email = ?`)
                    .bind(email)
                    .first();

        if (existing) {
          // If previously unsubscribed, re-subscribe them and continue to send email
          if (existing.unsubscribed === 1) {
            await env.DB.prepare(`UPDATE cat_shelf_guide SET unsubscribed = 0, unsubscribed_at = NULL WHERE email = ?`)
                        .bind(email)
                        .run();
            // Continue to send email below
          }
          // If already subscribed (unsubscribed = 0), still send email again
          // No action needed in database, just continue to send email
        } else {
          // New subscriber - add to database
          await env.DB.prepare(`INSERT INTO cat_shelf_guide (email, unsubscribed) VALUES (?, 0)`)
                      .bind(email)
                      .run();
        }
      } catch (dbErr) {
        console.error("Database error:", dbErr);
        return new Response(JSON.stringify({
          success: false,
          error: "Database error occurred"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // --- 2. Send email using SES ---
    const region = "us-east-2"; // SES region
    const accessKeyId = env.AWS_ACCESS_KEY_ID;
    const secretKey = env.AWS_SECRET_ACCESS_KEY;
    const from = "david@outdoorsavannah.com";
    const to = email;
    const driveUrl = env.CAT_SHELF_GUIDE_DRIVE_URL;

    // Generate access URL that goes through our validation endpoint
    const guideUrl = await generateAccessUrl(email, env.GUIDE_SERVICE_TOKEN);

    const endpoint = `https://email.${region}.amazonaws.com/`;

    // Construct SES API parameters
    const params = new URLSearchParams({
      Action: "SendEmail",
      Source: "Raja and David <david@outdoorsavannah.com>",
      "Destination.ToAddresses.member.1": to,
      "Message.Subject.Data": "😸 Your Cat Shelf Guide!",

        // Plain text version (for older email clients)
        "Message.Body.Text.Data": `Thanks for joining.
        I hope this inspires you to build your own cat friendly space!
        Download Cat Shelf Guide: ${guideUrl}`,
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
              height: 70px;
            }
            .content {
              padding: 40px 30px;
              text-align: center;
            }
            h1 {
              color: #1d1d1f;
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 12px;
            }
            p {
              font-size: 16px;
              color: #777;
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
              padding: 14px 28px;
              border-radius: 999px;
              font-size: 16px;
            }
            .links {
              margin-top: 20px;
              font-size: 14px;
            }
            .links a {
              color: #0069ff;
              text-decoration: none;
              margin: 0 12px;
            }
            .links a:hover {
              text-decoration: underline;
            }
            .footer {
              background: #3a3a3a;
              text-align: center;
              padding: 20px;
              font-size: 13px;
              color: #fff;
            }
            .footer a {
              color: #fff;
              text-decoration: none;
            }
            .unsubscribe {
              margin-top: 8px;
              display: block;
              color: #ccc;
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
                  <img src="http://www.outdoorsavannah.com/wp-content/uploads/2025/10/carousel-2-27-23-1_1.3.1-scaled.webp" alt="Cat Shelf Guide" width="100%" style="border-radius:8px;max-width:520px;">
                </div>
                <a href="${guideUrl}" class="button">Cat Shelf Guide (PDF)</a>
                <div class="links">
                  <a href="${guideUrl}" download="Easy-Cat-Shelves.pdf">Download</a>
                  <span style="color:#ccc;">|</span>
                  <a href="${driveUrl}" target="_blank">Get on Google Drive</a>
                </div>
              </div>
              <div class="footer">
                <a href="https://www.outdoorsavannah.com/">OutdoorSavannah.com</a>
                <p style="margin-top:12px;">
                  <a href="https://outdoorsavannah.com/api/unsubscribe?email=${encodeURIComponent(email)}" class="unsubscribe">
                    Unsubscribe
                  </a>
                </p>
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
