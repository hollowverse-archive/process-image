import { Handler, S3Event } from 'aws-lambda'; // tslint:disable-line:no-implicit-dependencies

export const cropFace: Handler<S3Event> = (event, _context, done) => {
  try {
    done(null);
  } catch (error) {
    console.error(error);
    done(error);
  }
};
