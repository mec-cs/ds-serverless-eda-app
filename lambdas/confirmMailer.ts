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
            const snsMessage = JSON.parse(record.Sns.Message); // Parse SNS message

            if (snsMessage.Records) {
                console.log("Record body ", JSON.stringify(snsMessage));

                for (const messageRecord of snsMessage.Records) {
                    const s3e = messageRecord.s3;

                    const srcBucket = s3e.bucket.name;
                    // Object key may have spaces or unicode non-ASCII characters.
                    const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));


                    console.log(`Bucket Name: ${srcBucket}`);
                    console.log(`Item ID: ${srcKey}`);

                    if (srcBucket && srcKey) {
                        const emailParams: MailParams = {
                            name: "S3 Bucket Image Upload",
                            email: SES_EMAIL_FROM,
                            message: `
                                    Your image file upload has been approved to the AWS S3 Bucket, 
                                    The file is in s3://${srcBucket}/${srcKey} .
                                `,
                        }

                        const formattedEmailParams = sendEmailParams(emailParams);
                        await sesClient.send(new SendEmailCommand(formattedEmailParams));
                    }
                }
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
                Data: `Image Upload to S3 Bucket Approved`,
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