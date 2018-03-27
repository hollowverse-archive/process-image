// tslint:disable:no-implicit-dependencies
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { cropImage, readFile } from './helpers';
import path from 'path';
import glob from 'fast-glob';
import bluebird from 'bluebird';
import { Rekognition } from 'aws-sdk';

expect.extend({ toMatchImageSnapshot });

describe('cropImage', () => {
  let directories: string[];

  beforeAll(async () => {
    directories = (await glob('*/', {
      cwd: path.join(__dirname, 'fixtures'),
      onlyDirectories: true,
      absolute: true,
    })) as string[];
  });

  it('given an image and a an array of face boxes, it crops the image correctly', async () => {
    await bluebird.map(
      directories,
      async directory => {
        const files = (await glob('*', {
          cwd: directory,
          absolute: true,
          onlyFiles: true,
        })) as string[];

        const [body, response] = await bluebird.map(files, async file =>
          readFile(file),
        );

        const detectFacesResponse = JSON.parse(
          String(response),
        ) as Rekognition.DetectFacesResponse;

        expect(
          await cropImage({
            body,
            rekognitionResponse: detectFacesResponse,
          }),
          // @ts-ignore
        ).toMatchImageSnapshot({
          customSnapshotIdentifier: path.basename(directory),
        });
      },
      { concurrency: 10 },
    );
  });
});
