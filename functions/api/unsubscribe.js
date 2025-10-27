/**
 * Unsubscribe endpoint for Cat Shelf Guide emails
 * Handles GET requests to /unsubscribe?email=user@example.com
 *
 * Database columns:
 * - unsubscribed: INTEGER (0 or 1)
 * - unsubscribed_at: TIMESTAMP
 */
export async function onRequest(context) {
  const db = context.env.DB; // D1 database binding
  const { searchParams } = new URL(context.request.url);
  const email = searchParams.get('email');

  // Validate email parameter
  if (!email) {
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error - Missing Email</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 80px 20px; background: #f5f6fa; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #e74c3c; margin-bottom: 16px; }
            p { color: #555; line-height: 1.6; }
            a { color: #0069ff; text-decoration: none; font-weight: 600; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚠️ Missing Email</h1>
            <p>No email address was provided in the unsubscribe link.</p>
            <p style="margin-top: 24px;"><a href="https://www.outdoorsavannah.com/">← Return to site</a></p>
          </div>
        </body>
      </html>
    `, {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error - Invalid Email</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 80px 20px; background: #f5f6fa; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #e74c3c; margin-bottom: 16px; }
            p { color: #555; line-height: 1.6; }
            a { color: #0069ff; text-decoration: none; font-weight: 600; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚠️ Invalid Email</h1>
            <p>The email address format is invalid.</p>
            <p style="margin-top: 24px;"><a href="https://www.outdoorsavannah.com/">← Return to site</a></p>
          </div>
        </body>
      </html>
    `, {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }

  try {
    // Check if email exists in database
    const result = await db.prepare(
      "SELECT email, unsubscribed FROM cat_shelf_guide WHERE email = ?"
    ).bind(email).first();

    if (!result) {
      // Email not found in database
      return new Response(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Not Found</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 80px 20px; background: #f5f6fa; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              h1 { color: #555; margin-bottom: 16px; }
              p { color: #666; line-height: 1.6; }
              a { color: #0069ff; text-decoration: none; font-weight: 600; }
              a:hover { text-decoration: underline; }
              .email { background: #f5f6fa; padding: 8px 12px; border-radius: 4px; font-family: monospace; color: #333; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>📭 Email Not Found</h1>
              <p>The email address <span class="email">${email}</span> is not in our mailing list.</p>
              <p>You may have already been removed, or never subscribed.</p>
              <p style="margin-top: 24px;"><a href="https://www.outdoorsavannah.com/">← Return to site</a></p>
            </div>
          </body>
        </html>
      `, {
        status: 404,
        headers: { "Content-Type": "text/html" }
      });
    }

    // Check if already unsubscribed
    if (result.unsubscribed === 1) {
      return new Response(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Already Unsubscribed</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 80px 20px; background: #f5f6fa; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              h1 { color: #555; margin-bottom: 16px; }
              p { color: #666; line-height: 1.6; }
              a { color: #0069ff; text-decoration: none; font-weight: 600; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✓ Already Unsubscribed</h1>
              <p>You're already unsubscribed from our mailing list.</p>
              <p>You won't receive any further emails from us.</p>
              <p style="margin-top: 24px;"><a href="https://www.outdoorsavannah.com/">← Return to site</a></p>
            </div>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html" }
      });
    }

    // Mark as unsubscribed
    await db.prepare(
      "UPDATE cat_shelf_guide SET unsubscribed = 1, unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?"
    ).bind(email).run();

    // Success response
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribed Successfully</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 80px 20px; background: #f5f6fa; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #27ae60; margin-bottom: 16px; font-size: 32px; }
            p { color: #555; line-height: 1.6; margin-bottom: 12px; }
            a { color: #0069ff; text-decoration: none; font-weight: 600; }
            a:hover { text-decoration: underline; }
            .divider { border-top: 1px solid #e0e0e0; margin: 32px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're unsubscribed 🐾</h1>
            <div class="divider"></div>
            <p style="margin-top: 24px;"><a href="https://www.outdoorsavannah.com/">← Return to site</a></p>
          </div>
        </body>
      </html>
    `, {
      headers: { "Content-Type": "text/html" }
    });

  } catch (err) {
    console.error("Unsubscribe error:", err);

    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 80px 20px; background: #f5f6fa; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #e74c3c; margin-bottom: 16px; }
            p { color: #555; line-height: 1.6; }
            a { color: #0069ff; text-decoration: none; font-weight: 600; }
            a:hover { text-decoration: underline; }
            code { background: #f5f6fa; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚠️ Something Went Wrong</h1>
            <p>We encountered an error while trying to unsubscribe you.</p>
            <p style="font-size: 14px; color: #888;">Error: <code>${err.message}</code></p>
            <p style="margin-top: 24px;">Please try again later or contact us at <a href="mailto:david@outdoorsavannah.com">david@outdoorsavannah.com</a></p>
            <p style="margin-top: 24px;"><a href="https://www.outdoorsavannah.com/">← Return to site</a></p>
          </div>
        </body>
      </html>
    `, {
      status: 500,
      headers: { "Content-Type": "text/html" }
    });
  }
}
