import awsSdk from 'aws-sdk';
import { Handler, S3Event } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies
import cloudinary from 'cloudinary';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';

const s3 = new awsSdk.S3({
  region: 'us-east-1',
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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
      const { Body } = await s3
        .getObject({
          Bucket: sourceBucketName,
          Key: sourceObjectKey,
        })
        .promise();

      const extensionName = path.extname(sourceObjectKey);

      const image = `data:image/${extensionName
        .split('.')
        .pop()};base64,${(Body as Buffer).toString('base64')}`;

      const { eager: [{ url }] } = await new Promise<any>(resolve =>
        cloudinary.uploader.upload(image, resolve, {
          eager: [
            {
              width: 500,
              height: 500,
              crop: 'thumb',
              gravity: 'faces',
              // format: 'jpg',
            },
          ],
        }),
      );

      const buffer = await (await fetch(url)).buffer();
      const targetObjectKey = sourceObjectKey;

      if (process.env.NODE === 'production') {
        await s3
          .putObject({
            Key: targetObjectKey,
            Bucket: targetBucketName,
            Body: buffer,
          })
          .promise();
      } else {
        fs.writeFileSync(path.basename(targetObjectKey), buffer);
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
