import { Handler, S3Event } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies
import awsSdk from 'aws-sdk';
import jimp from 'jimp';
import fs from 'fs';

const rekognition = new awsSdk.Rekognition({
  region: 'us-east-1',
});

const s3 = new awsSdk.S3({
  region: 'us-east-1',
});

export const cropFace: Handler<S3Event> = async (_event, _context, done) => {
  try {
    const fileName = 'Michael_Moore.jpg';
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
      const details = FaceDetails.filter(
        ({ Confidence, BoundingBox }) =>
          typeof Confidence === 'number' &&
          Confidence >= 0.85 &&
          BoundingBox !== undefined,
      ).map(({ BoundingBox }) => BoundingBox!);

      const { Body } = await s3
        .getObject({
          Bucket: 'hollowverse.public',
          Key: `notable-people/${fileName}`,
        })
        .promise();

      fs.writeFileSync('input.jpg', Body);

      const image = await jimp.read(Body as Buffer);
      const { width, height } = image.bitmap;

      const box = {
        top: height * Math.min(...details.map(({ Top }) => Top!)),
        height: height * Math.max(...details.map(({ Height }) => Height!)),
        left: width * Math.min(...details.map(({ Left }) => Left!)),
        width: width * Math.max(...details.map(({ Width }) => Width!)),
      };

      const boxScaling = 0.9;
      const croppedLeft = Math.max(0, box.left - box.left * boxScaling);
      const croppedTop = Math.max(0, box.top - box.top * boxScaling);
      const croppedWidth = Math.min(box.width + box.width * boxScaling, width);
      const croppedHeight = Math.min(
        box.height + box.height * boxScaling,
        height,
      );
      image.quality(85);

      image.crop(
        croppedLeft,
        croppedTop,
        Math.min(croppedWidth, croppedHeight),
        Math.min(croppedWidth, croppedHeight),
      );
      image.write('./output.jpg');
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
