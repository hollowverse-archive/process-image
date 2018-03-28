import awsSdk from 'aws-sdk';
import { Handler, S3Event } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies
import cloudinary from 'cloudinary';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';
import bluebird from 'bluebird';

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

export const processImage: Handler<S3Event> = async (event, _context, done) => {
  try {
    const { eventName } = event.Records[0];

    const {
      object: { key: sourceObjectKey },
      bucket: { name: sourceBucketName },
    } = event.Records[0].s3;

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
      const promises: Array<PromiseLike<any>> = [];

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
                  width: 500,
                  height: 500,
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

      const buffer = await (await fetch(url)).buffer();
      const deleteFileResultPromise = bluebird
        .fromCallback(cb => cloudinary.v2.api.delete_resources([public_id], cb))
        .catch(error =>
          console.error('Failed to delete Cloudinary resource.', error),
        );

      promises.push(deleteFileResultPromise);

      const targetObjectKey = sourceObjectKey;

      if (process.env.NODE_ENV === 'local') {
        promises.push(
          bluebird.fromCallback(cb =>
            fs.writeFile(path.basename(targetObjectKey), buffer, cb),
          ),
        );
      } else {
        const saveFileToTargetBucketPromise = s3
          .putObject({
            Key: targetObjectKey,
            Bucket: TARGET_BUCKET_NAME,
            Body: buffer,
          })
          .promise();

        promises.push(saveFileToTargetBucketPromise);
      }

      await Promise.all(promises);
    } else {
      throw new TypeError(`Unexpected event name: ${eventName}`);
    }

    done(null);
  } catch (error) {
    console.error(error);
    done(error);
  }
};
