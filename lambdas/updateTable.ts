// This Lambda fn will update the table according to the data

import { SNSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = new DynamoDBClient({ region: process.env.REGION });

export const handler: SNSHandler = async (event) => {
    console.log("Event", JSON.stringify(event));

    for (const record of event.Records) {

        const message = JSON.parse(record.Sns.Message);
        const parsedMessage = JSON.stringify(message);

        console.log(`SNS Incoming message: ${message}`);
    }

}