import awsSdk from 'aws-sdk';
import { Handler, S3Event, Context } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies
import cloudinary from 'cloudinary';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';
import bluebird from 'bluebird';
import s3UploadStream from 's3-upload-stream';

const {
  TARGET_BUCKET_NAME,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

const s3 = new awsSdk.S3({
  region: 'us-east-1',
});

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const createLambdaHandler = <E, R>(
  handleEvent: (event: E, context: Context) => Promise<R>,
): Handler<E, R> => async (event, context, done) => {
  try {
    done(null, await handleEvent(event, context));
  } catch (e) {
    console.error(e);
    done(e);
  }
};

export const processImage: Handler<S3Event> = createLambdaHandler(
  async (event, _context) => {
    const eventName = event.Records[0].eventName;
    const sourceObjectKey = decodeURIComponent(
      // S3 replaces spaces in URIs with a plus sign (+)
      event.Records[0].s3.object.key.replace(/\+/g, ' '),
    );
    const sourceBucketName = event.Records[0].s3.bucket.name;

    // Object removed in source bucket, mirror that change
    // in the target bucket
    if (eventName.startsWith('ObjectRemoved:')) {
      await s3
        .deleteObject({
          Bucket: TARGET_BUCKET_NAME,
          Key: sourceObjectKey,
        })
        .promise();
    } else if (eventName.startsWith('ObjectCreated:')) {
      const { public_id, eager: [{ url }] } = await bluebird.fromCallback(
        cb => {
          const downloadStream = s3
            .getObject({
              Bucket: sourceBucketName,
              Key: sourceObjectKey,
            })
            .createReadStream();

          const uploadStream = cloudinary.v2.uploader.upload_stream(
            {
              eager: [
                {
                  width: 350,
                  height: 350,
                  crop: 'thumb',
                  gravity: 'faces',
                },
              ],
            },
            cb,
          );

          downloadStream.pipe(uploadStream);
        },
      );

      const cloudinaryResponse = await fetch(url);
      const contentType = cloudinaryResponse.headers.get('Content-Type');

      const targetObjectKey = sourceObjectKey;

      if (process.env.NODE_ENV === 'local') {
        await bluebird.fromCallback(cb => {
          fs.writeFile(
            path.basename(targetObjectKey),
            cloudinaryResponse.body,
            cb,
          );
        });
      } else {
        await new Promise((resolve, reject) => {
          const uploadStream = s3UploadStream(s3)
            .upload({
              Key: targetObjectKey,
              Bucket: TARGET_BUCKET_NAME,
              CacheControl: 'public, max-age=31536000',
              ContentType: contentType,
            })
            .on('finish', resolve)
            .on('error', reject);

          cloudinaryResponse.body.pipe(uploadStream);
        });
      }

      await bluebird
        .fromCallback(cb => cloudinary.v2.api.delete_resources([public_id], cb))
        .catch(error => {
          console.error('Failed to delete Cloudinary resource.', error);
        });
    } else {
      throw new TypeError(`Unexpected event name: ${eventName}`);
    }
  },
);
