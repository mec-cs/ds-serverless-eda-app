// Reject Mailer Lambda Function Content

import { SQSHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
    SESClient,
    SendEmailCommand,
    SendEmailCommandInput,
} from "@aws-sdk/client-ses";

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

export const handler: SQSHandler = async (event: any) => {
    console.log("Event ", JSON.stringify(event));

    for (const record of event.Records) {
        const sqsRecordBody = JSON.parse(record.body);
        const snsMessage = JSON.parse(sqsRecordBody.Message);
        const snsS3Records = snsMessage.Records;

        if (snsS3Records) {
            console.log("Record body ", JSON.stringify(snsMessage));

            for (const msgRecord of snsS3Records) {
                const s3e = msgRecord.s3;
                const srcBucket = s3e.bucket.name;
                const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

                try {
                    const emailParams: MailParams = {
                        name: "AWS S3 Bucket & DynamoDB System",
                        email: SES_EMAIL_FROM,
                        message: `
                            Your image file upload to DynamoDB has been rejected, The file ${srcKey} is not a valid image format.  
                            [S3 Bucket path ://${srcBucket}]. Valid formats are ".jpeg" or ".png" , please check 
                            your image file format before the upload.
                        `,
                    }

                    const formattedEmailParams = sendEmailParams(emailParams);
                    await sesClient.send(new SendEmailCommand(formattedEmailParams));
                } catch (error: any) {
                    console.log("ERROR: ", error);
                }
            }
        }
    }
}

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
                Data: `Invalid Image Upload Rejected`,
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
        <h2>❌ S3 Bucket Image Upload to DynamoDB Rejected</h2>
        <p>Hello,</p>
        <p><strong>${message}</strong></p>
        <hr />
        <p><strong>Sent by:</strong> ${name}</p>
        <p><strong>Contact:</strong> ${email}</p>
      </body>
    </html>
    `;
}