// Log Image Lambda Function Content

import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = new DynamoDBClient({ region: process.env.REGION });

export const handler: SQSHandler = async (event) => {
    console.log("Event: ", JSON.stringify(event));

    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body).Message;
            const parsedMessage = JSON.parse(message);
            const fileName = parsedMessage.Records[0].s3.object.key;

            //console.log("Image file name: ", fileName);

            if (!fileName || (typeof fileName !== "string")) {
                throw new Error("Image file is missing or invalid!");
            }

            if (!fileName.endsWith(".jpeg") && !fileName.endsWith(".png")) {
                console.log(`Invalid Image Type: ${fileName}`)
                throw new Error(`Invalid Image Type: ${fileName}`);
            }

            const putImgOutput = await ddbDocClient.send(
                new PutCommand({
                    TableName: process.env.TABLE_NAME,
                    Item: { fileName },
                })
            );

            console.log("Successfull Put Image: ", fileName);
        } catch (error: any) {
            console.log("Error ", JSON.stringify(error));
            throw new Error(`Put Error: ${error}`);
        }
    }
};