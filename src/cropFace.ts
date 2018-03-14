import { Handler, S3Event } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies
import awsSdk from 'aws-sdk';

const rekognition = new awsSdk.Rekognition({
  region: 'us-east-1',
});

export const cropFace: Handler<S3Event> = async (_event, _context, done) => {
  try {
    const { FaceDetails, OrientationCorrection } = await rekognition
      .detectFaces({
        Image: {
          S3Object: {
            Bucket: 'hollowverse.public',
            Name: 'notable-people/Tom_Hanks.jpg',
          },
        },
      })
      .promise();

    console.log({
      ...FaceDetails,
      OrientationCorrection,
    });

    console.log({
      ...FaceDetails![0].Landmarks,
    });

    done(null);
  } catch (error) {
    console.error(error);
    done(error);
  }
};

cropFace(undefined as any, undefined as any, (err, data) => {
  console.log(err, data);
});
