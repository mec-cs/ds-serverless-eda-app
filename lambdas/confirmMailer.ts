// Confirm Mailer Lambda Function Content

import { SNSHandler } from "aws-lambda";
import {
    SESClient,
    SendEmailCommand,
    SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import { S3ImportSource } from "aws-cdk-lib/aws-cloudfront";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
    throw new Error(
        "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in an env.ts/js file located in the root directory"
    );
}

const sesClient = new SESClient({ region: SES_REGION });

type MailParams = {
    name: string;
    email: string;
    message: string;
};

export const handler: SNSHandler = async (event) => {
    console.log("Event ", JSON.stringify(event));

    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.Sns.Message);
            const s3Object = message.Records[0].s3;

            const bucketName = s3Object.bucket.name;
            const itemId = s3Object.object.key;

            console.log(`Bucket Name: ${bucketName}`);
            console.log(`Item ID: ${itemId}`);

            if (bucketName && itemId) {

                const emailParams: MailParams = {
                    name: "S3 Bucket Image Upload",
                    email: SES_EMAIL_FROM,
                    message: `
                            Your image file upload has been approved to the AWS S3 Bucket, 
                            The file is in s3://${bucketName}/${itemId} .
                        `,
                }

                const formattedEmailParams = sendEmailParams(emailParams);
                await sesClient.send(new SendEmailCommand(formattedEmailParams));
            }

        } catch (error: any) {
            console.log("Error: ", error);
        }
    }
};

function sendEmailParams({ name, email, message }: MailParams) {
    const parameters: SendEmailCommandInput = {
        Destination: {
            ToAddresses: [SES_EMAIL_TO],
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: getHtmlContent({ name, email, message }),
                },
                // Text: {.           // For demo purposes
                //   Charset: "UTF-8",
                //   Data: getTextContent({ name, email, message }),
                // },
            },
            Subject: {
                Charset: "UTF-8",
                Data: `New image Upload`,
            },
        },
        Source: SES_EMAIL_FROM,
    };
    return parameters;
}

function getHtmlContent({ name, email, message }: MailParams) {
    return `
    <html>
      <body>
        <h2>✅ S3 Bucket Image Upload Approved</h2>
        <p>Hello,</p>
        <p><strong>${message}</strong></p>
        <hr />
        <p><strong>Sent by:</strong> ${name}</p>
        <p><strong>Contact:</strong> ${email}</p>
      </body>
    </html>
    `;
}