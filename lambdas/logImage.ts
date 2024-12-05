// Log Image Lambda Function Content

import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = new DynamoDBClient({ region: process.env.REGION });

export const handler: SQSHandler = async (event) => {
    console.log("Event: ", JSON.stringify(event));

    for (const record of event.Records) {
        try {

            const recordBody = JSON.parse(record.body);        // Parse SQS message
            const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

            if (snsMessage.Records) {

                console.log("Record body ", JSON.stringify(snsMessage));

                for (const messageRecord of snsMessage.Records) {
                    const s3e = messageRecord.s3;
                    const srcBucket = s3e.bucket.name;

                    // Object key may have spaces or unicode non-ASCII characters.
                    const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

                    try {
                        // if image item not ends with .jpeg or .png extension
                        if (!srcKey.endsWith(".jpeg") && !srcKey.endsWith(".png")) {
                            console.log(`Invalid Image Type: ${srcKey}`)
                            throw new Error(`Invalid Image Type: ${srcKey}`);
                        } else {
                            const putImgOutput = await ddbDocClient.send(
                                new PutCommand({
                                    TableName: process.env.TABLE_NAME,
                                    Item: {
                                        fileName: srcKey
                                    },
                                })
                            );

                            console.log("Put Image Status Code: ", putImgOutput.$metadata.httpStatusCode);
                            console.log("Successfull Put Image to bucket: ", srcBucket, "/", srcKey);
                        }
                    }
                    catch (error) {
                        console.log("Error, ", error);
                        throw new Error(`Put Error: ${error}`);
                    }
                }
            }
        } catch (error: any) {
            console.log("Error, ", error);
            throw new Error(`Error: ${error}`);
        }
    }
};