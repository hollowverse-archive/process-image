import {
  transform,
  translate,
  scale,
  applyToPoint,
} from 'transformation-matrix';
import fs from 'fs';

export const readFile = bluebird.promisify(fs.readFile);

export type BoundingBox = {
  top: number;
  left: number;
  height: number;
  width: number;
};

/**
 * Scale a box around its center point by the given scale factor
 * @see https://www.safaribooksonline.com/library/view/svg-essentials/0596002238/ch05s06.html
 */
export const scaleBox = (
  { left, top, width, height }: BoundingBox,
  factor: number,
): BoundingBox => {
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const right = width + left;
  const bottom = top + height;

  const matrix = transform(
    translate(centerX * (1 - factor), centerY * (1 - factor)),
    scale(factor, factor),
  );

  const p1 = applyToPoint(matrix, { x: left, y: top });
  const p2 = applyToPoint(matrix, { x: right, y: bottom });

  return {
    top: p1.y,
    left: p1.x,
    height: p2.y - p1.y,
    width: p2.x - p1.x,
  };
};

/** Find the smallest box that contains all the given boxes */
export const getMinimumBoundingBoxForBoxes = (
  boxes: BoundingBox[],
): BoundingBox => {
  const _boxes = boxes.map(({ top, left, width, height }) => ({
    top,
    left,
    right: width + left,
    bottom: top + height,
  }));

  const minTop = Math.min(..._boxes.map(({ top }) => top));
  const minLeft = Math.min(..._boxes.map(({ left }) => left));
  const maxBottom = Math.max(..._boxes.map(({ bottom }) => bottom));
  const maxRight = Math.max(..._boxes.map(({ right }) => right));

  return {
    top: minTop,
    height: maxBottom - minTop,
    left: minLeft,
    width: maxRight - minLeft,
  };
};

import jimp from 'jimp';
import bluebird from 'bluebird';
import { DetectFacesResponse } from 'aws-sdk/clients/rekognition';
import { floor } from 'lodash';

type CropImageOptions = {
  body: Buffer;
  rekognitionResponse: DetectFacesResponse;
};

export const cropImage = async ({
  body,
  rekognitionResponse,
}: CropImageOptions) => {
  const image = await jimp.read(body);
  const { width: actualWidth, height: actualHeight } = image.bitmap;
  if (
    rekognitionResponse.FaceDetails &&
    rekognitionResponse.FaceDetails.length > 0
  ) {
    const minBoundingBox = getMinimumBoundingBoxForBoxes(
      // tslint:disable:no-non-null-assertion
      rekognitionResponse.FaceDetails.map(details => details.BoundingBox!).map(
        (faceBox): BoundingBox => ({
          top: faceBox.Top! * actualHeight,
          height: faceBox.Height! * actualHeight,
          left: faceBox.Left! * actualWidth,
          width: faceBox.Width! * actualWidth,
        }),
      ),
    );

    const centerX = minBoundingBox.width / 2;
    const centerY = minBoundingBox.height / 2;
    const centerXToOriginal = centerX + minBoundingBox.left;
    const centerYToOriginal = centerY + minBoundingBox.top;

    console.log({ centerX, centerY, centerXToOriginal, centerYToOriginal });

    const maxPossibleBoxScaling = floor(
      Math.min(centerXToOriginal / centerX, centerYToOriginal / centerY),
      1,
    );

    const finalBox = scaleBox(minBoundingBox, maxPossibleBoxScaling);

    console.log({
      minBoundingBox,
      finalBox,
      maxPossibleBoxScaling,
    });

    // const minActualDimension = Math.min(actualHeight, actualWidth);

    image.crop(finalBox.left, finalBox.top, finalBox.width, finalBox.height);

    image.background(0x000000);

    const minAcceptableDim = Math.min(actualHeight, actualWidth);
    console.log({ minAcceptableDim });
    image.contain(minAcceptableDim, minAcceptableDim);

    // await bluebird.fromCallback(cb => {
    //   image.con
    // });
  }

  return bluebird.fromCallback<Buffer>(cb => image.getBuffer('image/png', cb));
};
