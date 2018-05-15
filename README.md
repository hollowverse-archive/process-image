# `process-image` [![Build Status](https://travis-ci.org/hollowverse/process-image.svg?branch=master)](https://travis-ci.org/hollowverse/process-image)

An AWS Lambda that monitors images of notable people in an S3 bucket, and crops any newly added images around the face(s) using [the Cloudinary API](https://cloudinary.com/documentation/solution_overview). The cropped images are saved in another S3 bucket.

In addition to watching for new images, this function also watches images deleted in the source bucket and deletes the corresponding images from the target bucket.

---

[If you'd like to tell us something, or need help with anything...](https://github.com/hollowverse/hollowverse/wiki/Help)
