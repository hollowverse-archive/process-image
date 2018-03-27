const glob = require('fast-glob');
const bluebird = require('bluebird');
const jimp = require('jimp');

async function crop(imagePath) {
  const image = await jimp.read(imagePath);
  const { height, width } = image.bitmap;
  const newWidth = 400;
  const newHeight = height * (newWidth / width);

  await bluebird.fromCallback(cb =>
    image.resize(newWidth, newHeight, '', () => {
      image.write(`${imagePath}`, cb);
    }),
  );
}

async function main() {
  const files = await glob('**/*', { ignore: ['response.json'] });
  await bluebird.map(files, crop);
}

main().then(console.error);
