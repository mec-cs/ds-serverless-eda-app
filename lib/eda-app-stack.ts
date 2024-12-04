import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Duration } from "aws-cdk-lib";

import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // S3 Bucket implementation

    const s3ImageBucket = new s3.Bucket(this, "imageBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });


    // SNS Topic

    const s3ImageTopic = new sns.Topic(this, "NewS3ImageTopic", {
      displayName: "New S3 Image Topic",
    });


    // S3 Bucket --> SQS

    s3ImageBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(s3ImageTopic)
    );


    // DynamoDB creation

    const imageDynamoDbTable = new dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "fileName", type: dynamodb.AttributeType.STRING },
    });


    // SQS queues, and DLQ

    const deadLetterQueue = new sqs.Queue(this, "imageDLQ", {
      retentionPeriod: Duration.minutes(10),
    });

    const imgProcQueue = new sqs.Queue(this, "ImageProcessQueue", {
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 1,
      },
    });


    // Lambda functions

    const commonProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(15),
    } as cdk.aws_lambda_nodejs.NodejsFunctionProps;

    const confirmMailerFn = new lambdanode.NodejsFunction(this, "ConfirmMailerFn", {
      ...commonProps,
      entry: `${__dirname}/../lambdas/confirmMailer.ts`,
    });

    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      ...commonProps,
      entry: `${__dirname}/../lambdas/logImage.ts`,
      environment: {
        TABLE_NAME: imageDynamoDbTable.tableName,
      },
    });

    const rejectMailerFn = new lambdanode.NodejsFunction(this, "RejectMailerFn", {
      ...commonProps,
      entry: `${__dirname}/../lambdas/rejectMailer.ts`,
    });

    const updateTableFn = new lambdanode.NodejsFunction(this, "UpdateTableFn", {
      ...commonProps,
      entry: `${__dirname}/../lambdas/updateTable.ts`,
      environment: {
        TABLE_NAME: imageDynamoDbTable.tableName,
      },
    });

    // Subscriptions

    // filter mechanisms applied to subscriptions
    // // only Caption-Date-Photographer metadata types are allowed
    const subFilterPolicy: cdk.aws_sns_subscriptions.LambdaSubscriptionProps = {
      metadata_type: sns.SubscriptionFilter.stringFilter({
        allowlist: ["Caption", "Date", "Photographer"],
      }),
    } as cdk.aws_sns_subscriptions.LambdaSubscriptionProps;

    s3ImageTopic.addSubscription(
      new subs.LambdaSubscription(confirmMailerFn, subFilterPolicy)
    );

    s3ImageTopic.addSubscription(
      new subs.SqsSubscription(imgProcQueue, subFilterPolicy),
    );

    s3ImageTopic.addSubscription(
      new subs.LambdaSubscription(updateTableFn, subFilterPolicy),
    );


    // SQS --> Lambda, Event sources

    const imgProcEventSource = new events.SqsEventSource(imgProcQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    const dlqEventSource = new events.SqsEventSource(deadLetterQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });


    // Event sources

    logImageFn.addEventSource(imgProcEventSource);

    rejectMailerFn.addEventSource(dlqEventSource);


    // Permissions & Policies

    imageDynamoDbTable.grantFullAccess(logImageFn);

    // Mail IAM Policy for both Mail Lambda fns
    const mailPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
      ],
      resources: ["*"],
    })

    rejectMailerFn.addToRolePolicy(mailPolicyStatement);

    confirmMailerFn.addToRolePolicy(mailPolicyStatement);


    new cdk.CfnOutput(this, "bucketName", {
      value: s3ImageBucket.bucketName,
    });

  }
}
