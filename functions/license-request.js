import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

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

    // Create SES client
    const client = new SESClient({
      region: 'us-east-2', // your SES region
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new SendEmailCommand({
      Destination: { ToAddresses: ['david@outdoorsavannah.com'] },
      Message: {
        Body: { Text: { Data: emailBody } },
        Subject: { Data: 'New License Request' }
      },
      Source: 'david@outdoorsavannah.com'
    });

    await client.send(command);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
