import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadBuffer(buffer: Buffer, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const folder = process.env.CLOUDINARY_FOLDER || 'wa-scheduler';
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', public_id: filename },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          if (!result?.secure_url) {
            reject(new Error('Cloudinary did not return a secure_url'));
            return;
          }
          resolve(result.secure_url);
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  async deleteByUrl(url: string): Promise<void> {
    const parts = url.split('/');
    const folder = process.env.CLOUDINARY_FOLDER || 'wa-scheduler';
    const filename = parts[parts.length - 1].replace(/\.[^.]+$/, '');
    const publicId = `${folder}/${filename}`;
    await cloudinary.uploader.destroy(publicId);
  }
}
