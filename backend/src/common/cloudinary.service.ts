import { Injectable } from "@nestjs/common";
// Use require to avoid type-resolution issues across environments.
const cloudinary = require("cloudinary").v2;

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  async uploadScheduleImage(
    file: { buffer: Buffer },
    tenantId: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("cloudinary_not_configured");
    }

    const baseFolder = process.env.CLOUDINARY_FOLDER || "wa-scheduler";
    const folder = `${baseFolder}/tenants/${tenantId}/schedules`;

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image"
        },
        (err, uploaded) => {
          if (err) return reject(err);
          resolve(uploaded);
        }
      );
      stream.end(file.buffer);
    });

    return result.secure_url;
  }
}
