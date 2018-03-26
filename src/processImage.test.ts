// tslint:disable:no-implicit-dependencies
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { cropImage, BoundingBox } from './helpers';
import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';
import bluebird from 'bluebird';

expect.extend({ toMatchImageSnapshot });

describe('cropImage', () => {
  let fixtureImages: string[];

  beforeAll(async () => {
    fixtureImages = (await glob('!*.json', {
      cwd: path.join(__dirname, 'fixtures'),
      absolute: true,
    })) as string[];
  });

  it('given an image and a an array of face boxes, it crops the image correctly', async () => {
    await bluebird.map(fixtureImages, async fixtureImage => {
      const [boxes, body] = await bluebird.map(
        [`${fixtureImage}.json`, fixtureImage],
        async file =>
          bluebird.fromCallback<Buffer>(cb => {
            fs.readFile(file, cb);
          }),
      );

      expect(
        await cropImage({
          body,
          faceBoxes: JSON.parse(String(boxes)) as BoundingBox[],
        }),
        // @ts-ignore
      ).toMatchImageSnapshot({
        customSnapshotIdentifier: path.basename(fixtureImage),
      });
    });
  });
});
