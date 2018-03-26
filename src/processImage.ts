import awsSdk from 'aws-sdk';
import { cropImage } from './helpers';
import { Handler, S3Event } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies

const rekognition = new awsSdk.Rekognition({
  region: 'us-east-1',
});

const s3 = new awsSdk.S3({
  region: 'us-east-1',
});

// tslint:disable-next-line:max-func-body-length
export const processImage: Handler<S3Event> = async (event, _context, done) => {
  try {
    const { eventName } = event.Records[0];
    const targetBucketName = 'hollowverse.public-test';

    const {
      object: { key: sourceObjectKey },
      bucket: { name: sourceBucketName },
    } = event.Records[0].s3;

    // Object removed in source bucket, mirror that change
    // in the target bucket
    if (eventName.startsWith('ObjectRemoved:')) {
      await s3
        .deleteObject({
          Bucket: targetBucketName,
          Key: sourceObjectKey,
        })
        .promise();
    } else if (eventName.startsWith('ObjectCreated:')) {
      const { FaceDetails } = await rekognition
        .detectFaces({
          Image: {
            S3Object: {
              Bucket: sourceBucketName,
              Name: sourceObjectKey,
            },
          },
        })
        .promise();

      if (FaceDetails !== undefined && FaceDetails.length > 0) {
        const { Body } = await s3
          .getObject({
            Bucket: sourceBucketName,
            Key: sourceObjectKey,
          })
          .promise();

        const faceBoxes = FaceDetails.filter(
          ({ Confidence, BoundingBox }) =>
            typeof Confidence === 'number' &&
            Confidence >= 0.85 &&
            BoundingBox !== undefined,
        ).map(({ BoundingBox }) => {
          // tslint:disable no-non-null-assertion
          const { Top, Left, Width, Height } = BoundingBox!;

          return {
            top: Top!,
            height: Height!,
            left: Left!,
            width: Width!,
          };
          // tslint:enable no-non-null-assertion
        });

        const buffer = await cropImage({ faceBoxes, body: Body as Buffer });

        await s3
          .putObject({
            Key: sourceObjectKey,
            Bucket: targetBucketName,
            Body: buffer,
          })
          .promise();
      }
    } else {
      throw new TypeError(`Unexpected event name: ${eventName}`);
    }

    done(null);
  } catch (error) {
    console.error(error);
    done(error);
  }
};
