// Log Image Lambda Function Content

import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = new DynamoDBClient({ region: process.env.REGION });

export const handler: SQSHandler = async (event) => {
    console.log("Event: ", JSON.stringify(event));

    for (const record of event.Records) {
        try {
            const recordBody = JSON.parse(record.body); // Parse SQS message
            const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message
            const snsS3Records = snsMessage.Records;

            if (snsS3Records) {
                console.log("Parsed SNS Message: ", JSON.stringify(snsMessage));

                for (const msgRecord of snsS3Records) {
                    const s3e = msgRecord.s3;
                    const srcBucket = s3e.bucket.name;
                    const msgEventName = msgRecord.eventName;

                    const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

                    if (!srcKey.endsWith(".jpeg") && !srcKey.endsWith(".png")) {
                        console.log(`Invalid Image Type: ${srcKey}`);
                        throw new Error(`Invalid Image Type: ${srcKey}`);
                    }

                    // ObjectCreated:Put logic
                    if (msgEventName === "ObjectCreated:Put") {

                        const putImgOutput = await ddbDocClient.send(
                            new PutCommand({
                                TableName: process.env.TABLE_NAME,
                                Item: { fileName: srcKey },
                            })
                        );

                        console.log("Put Image Status Code: ", putImgOutput.$metadata.httpStatusCode);
                        console.log("Put Image : ", srcKey);

                        // ObjectRemoved:Delete logic
                    } else if (msgEventName === "ObjectRemoved:Delete") {

                        const deleteImgOutput = await ddbDocClient.send(
                            new DeleteCommand({
                                TableName: process.env.TABLE_NAME,
                                Key: { fileName: srcKey },
                            })
                        );

                        console.log("Delete Image Status Code: ", deleteImgOutput.$metadata.httpStatusCode);
                        console.log("Deleted Image", srcKey);
                    }
                }
            }
        } catch (error: any) {
            console.error("Error processing record: ", error);
            throw new Error("Cannot process the file!");
        }
    }
};