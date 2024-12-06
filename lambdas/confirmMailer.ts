// Confirm Mailer Lambda Function Content


import type { DynamoDBStreamHandler } from "aws-lambda";
import {
    SESClient,
    SendEmailCommand,
    SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";

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

export const handler: DynamoDBStreamHandler = (event) => {
    console.log("Event ", JSON.stringify(event));

    for (const record of event.Records) {
        try {
            const ddbEventName = record.eventName;

            if (ddbEventName && ddbEventName === "INSERT") {
                console.log("New Event Processed: ", ddbEventName);

                const key = record.dynamodb?.Keys;

                const emailParams: MailParams = {
                    name: "DynamoDB Image Table Upload",
                    email: SES_EMAIL_FROM,
                    message: `
                                        Your image file upload to the DynamoDB Table has been successfull, 
                                        The image file information is ${key} .
                                    `,
                }

                const formattedEmailParams = sendEmailParams(emailParams);
                sesClient.send(new SendEmailCommand(formattedEmailParams));
            }

        } catch (error: any) {
            console.log("Error, ", error);
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
                Data: `Image Upload to DynamoDatabase Table`,
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
        <h2>✅ DynamoDB Image Upload Approved</h2>
        <p>Hello,</p>
        <p><strong>${message}</strong></p>
        <hr />
        <p><strong>Sent by:</strong> ${name}</p>
        <p><strong>Contact:</strong> ${email}</p>
      </body>
    </html>
    `;
}