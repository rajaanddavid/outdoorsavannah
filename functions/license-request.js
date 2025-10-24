import AWS from 'aws-sdk';

export async function onRequestPost({ request }) {
  try {
    // Parse form data
    const formData = await request.formData();

    const company    = formData.get('company') || '';
    const name       = formData.get('name') || '';
    const email      = formData.get('email') || '';
    const typeOfUse  = formData.get('typeOfUse') || '';
    const works      = formData.get('works') || '';
    const duration   = formData.get('duration') || '';
    const fee        = formData.get('fee') || '';

    // Compose email body
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

    // Configure AWS SES
    const ses = new AWS.SES({
      region: 'us-east-2', // change to your SES region
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const params = {
      Destination: {
        ToAddresses: ['david@outdoorsavannah.com'] // change to your receiving email
      },
      Message: {
        Body: {
          Text: { Data: emailBody }
        },
        Subject: { Data: 'New License Request' }
      },
      Source: 'david@outdoorsavannah.com' // must be a verified SES sender
    };

    await ses.sendEmail(params).promise();

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
