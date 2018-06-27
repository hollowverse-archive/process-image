import { S3 } from 'aws-sdk';
import cloudinary from 'cloudinary';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';
import bluebird from 'bluebird';
import s3UploadStream from 's3-upload-stream';
import { readAwsSecretStringForStage } from '@hollowverse/utils/helpers/readAwsSecretStringForStage';

const { TARGET_BUCKET_NAME } = process.env;

const s3 = new S3({
  region: 'us-east-1',
});

const configureCloudinary = readAwsSecretStringForStage(
  'cloudinary/apiConfig',
).then(config => {
  if (config === undefined) {
    throw new TypeError('Could not get Cloudinary config');
  }
  cloudinary.config(JSON.parse(config));
});

export const processImage = async (event: AWSLambda.S3Event) => {
  await configureCloudinary;

  if (!TARGET_BUCKET_NAME) {
    throw new TypeError(
      'Target bucket name was no specified, make sure it is passed as an environment variable',
    );
  }

  const { eventName } = event.Records[0];
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
    const {
      public_id: publicId,
      eager: [{ url }],
    } = await bluebird.fromCallback(async cb => {
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
    });

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
      .fromCallback(cb => cloudinary.v2.api.delete_resources([publicId], cb))
      .catch(error => {
        console.error('Failed to delete Cloudinary resource.', error);
      });
  } else {
    throw new TypeError(`Unexpected event name: ${eventName}`);
  }
};
