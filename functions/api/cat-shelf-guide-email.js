export async function onRequestPost({ request, env }) {
  try {
    const { email } = await request.json();
    if (!email) throw new Error("Email is required");

    // 1️⃣ Log email (using KV or D1)
    // Example: KV
    await env.EMAIL_LOG.put(`email:${email}`, new Date().toISOString());

    // 2️⃣ Send email with guide link
    const guideLink = "https://www.outdoorsavannah.com/cat-shelf-guide.pdf";
    const body = `Hi!\n\nThanks for signing up. Download your Cat Shelf Guide here:\n${guideLink}\n\nEnjoy!`;

    const region = "us-east-2";
    const accessKeyId = env.AWS_ACCESS_KEY_ID;
    const secretKey = env.AWS_SECRET_ACCESS_KEY;
    const from = "david@outdoorsavannah.com";
    const to = email;

    // Use your existing AWS SES signing function here:
    const params = new URLSearchParams({
      Action: "SendEmail",
      Source: from,
      "Destination.ToAddresses.member.1": to,
      "Message.Subject.Data": "Your Cat Shelf Guide",
      "Message.Body.Text.Data": body
    });

    const signedHeaders = await signAWSv4({
      method: "POST",
      url: `https://email.${region}.amazonaws.com/`,
      region,
      service: "ses",
      body: params.toString(),
      accessKeyId,
      secretKey
    });

    const res = await fetch(`https://email.${region}.amazonaws.com/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...signedHeaders },
      body: params.toString()
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
