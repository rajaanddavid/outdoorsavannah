export async function onRequest(context) {
  const db = context.env.DB; // your D1 binding name
  const { searchParams } = new URL(context.request.url);
  const email = searchParams.get('email');

  if (!email) {
    return new Response("Missing email parameter.", { status: 400 });
  }

  try {
    // Mark as unsubscribed (or delete)
    await db.prepare("UPDATE cat_shelf_guide SET unsubscribed = 1, unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?").bind(email).run();

    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Unsubscribed</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 80px; }
            h1 { color: #111; }
            a { color: #0073ff; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>You're unsubscribed 🐾</h1>
          <p><a href="https://www.outdoorsavannah.com/">Return to site</a></p>
        </body>
      </html>
    `, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
