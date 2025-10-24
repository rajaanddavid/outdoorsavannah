// license-request.js
import crypto from "crypto";

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

    // AWS SES settings
    const region = "us-east-2"; // change to your region
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const from = "david@outdoorsavannah.com";   // verified SES sender
    const to = "david@outdoorsavannah.com";     // recipient

    // SES endpoint
    const endpoint = `https://email.${region}.amazonaws.com/`;

    // Construct SES API parameters
    const params = new URLSearchParams({
      Action: "SendEmail",
      "Source": from,
      "Destination.ToAddresses.member.1": to,
      "Message.Subject.Data": "New License Request",
      "Message.Body.Text.Data": emailBody,
    });

    // Generate signed headers using AWS Signature v4
    const signedHeaders = signAWSv4({
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

// --------------------
// AWS Signature v4 helper
// --------------------
function signAWSv4({ method, url, region, service, body, accessKeyId, secretKey }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname;

  const canonicalQuerystring = "";

  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";

  const payloadHash = hash(body);
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${hash(canonicalRequest)}`;

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign, "hex");

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    "Authorization": authorizationHeader,
    "X-Amz-Date": amzDate
  };
}

function hash(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function hmac(key, str, encoding) {
  return crypto.createHmac("sha256", key).update(str, "utf8").digest(encoding);
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac("sha256", "AWS4" + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(regionName).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
  return kSigning;
}
