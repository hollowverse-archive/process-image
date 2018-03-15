import { Handler, S3Event } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies
import awsSdk from 'aws-sdk';
import jimp from 'jimp';
import fs from 'fs';
import { getSmallestBoundingBoxForBoxes, scaleBox } from './helpers';

const rekognition = new awsSdk.Rekognition({
  region: 'us-east-1',
});

const s3 = new awsSdk.S3({
  region: 'us-east-1',
});

export const cropFace: Handler<S3Event> = async (_event, _context, done) => {
  try {
    const fileName = 'Alyssa_Milano.jpg';
    const { FaceDetails } = await rekognition
      .detectFaces({
        Image: {
          S3Object: {
            Bucket: 'hollowverse.public',
            Name: `notable-people/${fileName}`,
          },
        },
      })
      .promise();

    if (Array.isArray(FaceDetails) && FaceDetails.length > 0) {
      const { Body } = await s3
        .getObject({
          Bucket: 'hollowverse.public',
          Key: `notable-people/${fileName}`,
        })
        .promise();

      fs.writeFileSync('input.jpg', Body);

      const image = await jimp.read(Body as Buffer);
      const { width: actualWidth, height: actualHeight } = image.bitmap;

      const faceBoxes = FaceDetails.filter(
        ({ Confidence, BoundingBox }) =>
          typeof Confidence === 'number' &&
          Confidence >= 0.85 &&
          BoundingBox !== undefined,
      ).map(({ BoundingBox }) => {
        // tslint:disable no-non-null-assertion
        const { Top, Left, Width, Height } = BoundingBox!;

        return {
          top: actualHeight * Top!,
          height: actualHeight * Height!,
          left: actualWidth * Left!,
          width: actualWidth * Width!,
        };
        // tslint:enable no-non-null-assertion
      });

      const smallestBoundingBox = getSmallestBoundingBoxForBoxes(faceBoxes);

      const scale = Math.min(
        actualWidth / smallestBoundingBox.width,
        actualHeight / smallestBoundingBox.height,
      );

      const finalBox = scaleBox(smallestBoundingBox, scale);
      const minDimension = Math.min(finalBox.height, finalBox.width);

      image.crop(finalBox.left, finalBox.top, minDimension, minDimension);

      image.write('./output.jpg', () => {
        done(null);
      });
    }

    done(null);
  } catch (error) {
    console.error(error);
    done(error);
  }
};

cropFace(undefined as any, undefined as any, (err, data) => {
  console.log(err, data);
});
