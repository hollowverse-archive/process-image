import {
  transform,
  translate,
  scale,
  applyToPoint,
} from 'transformation-matrix';

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
export const getSmallestBoundingBoxForBoxes = (
  boxes: BoundingBox[],
): BoundingBox => {
  return {
    top: Math.min(...boxes.map(({ top }) => top)),
    height: Math.max(...boxes.map(({ height }) => height)),
    left: Math.min(...boxes.map(({ left }) => left)),
    width: Math.max(...boxes.map(({ width }) => width)),
  };
};

import jimp from 'jimp';
import bluebird from 'bluebird';

type CropImageOptions = {
  body: Buffer;
  faceBoxes: BoundingBox[];
};

export const cropImage = async ({ body, faceBoxes }: CropImageOptions) => {
  const image = await jimp.read(body);
  const { width: actualWidth, height: actualHeight } = image.bitmap;
  const smallestBoundingBox = getSmallestBoundingBoxForBoxes(
    faceBoxes.map((faceBox): BoundingBox => ({
      top: faceBox.top * actualHeight,
      height: faceBox.height * actualHeight,
      left: faceBox.left * actualWidth,
      width: faceBox.width * actualWidth,
    })),
  );

  const boxScaling = Math.min(
    actualWidth / smallestBoundingBox.width,
    actualHeight / smallestBoundingBox.height,
  );

  const finalBox = scaleBox(smallestBoundingBox, boxScaling);
  const minDimension = Math.min(finalBox.height, finalBox.width);

  image.crop(
    Math.max(0, finalBox.left),
    Math.max(0, finalBox.top),
    minDimension,
    minDimension,
  );

  return bluebird.fromCallback<Buffer>(cb =>
    image.getBuffer(image.getMIME(), cb),
  );
};
