// Confirm Mailer Lambda Function Content

import { SQSHandler } from "aws-lambda";

export const handler: SQSHandler = async (event) => {
    console.log("Event ", JSON.stringify(event));
};
