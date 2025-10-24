// license-request.js
// Cloudflare Pages Function to send license request via AWS SES

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
export async function onRequestPost({ request }) {
  try {
    const formData = await request.formData();

    const company    = formData.get('company') || '';
    const name       = formData.get('name') || '';
    const email      = formData.get('email') || '';
    const typeOfUse  = formData.get('typeOfUse') || '';
    const works      = formData.get('works') || '';
    const duration   = formData.get('duration') || '';
    const fee        = formData.get('fee') || '';

    const emailBody = `
Company: ${company}
Name: ${name}
Email: ${email}
Type of Use: ${typeOfUse}
List of Works to License:
${works}
Duration of Use: ${duration}
Proposed Fee: ${fee}
`;

    const region = "us-east-2"; // your SES region
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const from = "david@outdoorsavannah.com";   // verified SES sender
    const to = "david@outdoorsavannah.com";     // recipient

    const endpoint = `https://email.${region}.amazonaws.com/`;

    const params = new URLSearchParams({
      Action: "SendEmail",
      "Source": from,
      "Destination.ToAddresses.member.1": to,
      "Message.Subject.Data": "New License Request",
      "Message.Body.Text.Data": emailBody,
    });

    const signedHeaders = await signAWSv4({
      method: "POST",
      url: endpoint,
      region,
      service: "ses",
      body: params.toString(),
      accessKeyId,
      secretKey
    });

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
