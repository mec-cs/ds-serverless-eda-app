// This Lambda fn will update the table according to the data

import { SNSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = new DynamoDBClient({ region: process.env.REGION });

export const handler: SNSHandler = async (event) => {
    console.log("Event", JSON.stringify(event));

    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.Sns.Message);
            const metadataType = record.Sns.MessageAttributes.metadata_type.Value;

            // console.log(`SNS Incoming message: ${parsedMessage}`);

            const { id, value } = message || undefined;

            if (id && value && metadataType) {

                const updateTableOuput = await ddbDocClient.send(
                    new UpdateCommand({
                        TableName: process.env.TABLE_NAME,
                        Key: {
                            fileName: id,
                        },
                        UpdateExpression: `SET ${metadataType} = :value`,
                        ExpressionAttributeValues: {
                            ":value": value,
                        },
                    })
                );

                console.log(`Update Metadata, Item ID: ${id} , Process Status Code: ${updateTableOuput.$metadata.httpStatusCode}`);
            }
        } catch (error: any) {
            console.log("Error: ", error);
        }
    }
}