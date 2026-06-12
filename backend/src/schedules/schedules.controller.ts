import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { SchedulesService } from "./schedules.service";
import { CreateScheduleDto, UpdateScheduleDto } from "./dto";
import { CloudinaryService } from "../common/cloudinary.service";
import { TenantContext } from "../common/tenant-context";

type UploadedImageFile = {
  mimetype?: string;
  buffer: Buffer;
};

@Controller("schedules")
export class SchedulesController {
  constructor(
    private readonly svc: SchedulesService,
    private readonly cloudinary: CloudinaryService,
    private readonly ctx: TenantContext
  ) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.svc.get(id);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor("images", 5, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async create(
    @Body() dto: CreateScheduleDto,
    @UploadedFiles() files?: UploadedImageFile[]
  ) {
    const uploaded = await this.uploadImages(files ?? []);
    const combined = [...(dto.imageUrls ?? []), ...uploaded];
    if (combined.length > 5) {
      throw new BadRequestException("You can attach up to 5 images");
    }
    return this.svc.create({ ...dto, imageUrls: combined });
  }

  @Patch(":id")
  @UseInterceptors(
    FilesInterceptor("images", 5, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateScheduleDto,
    @UploadedFiles() files?: UploadedImageFile[]
  ) {
    const uploaded = await this.uploadImages(files ?? []);
    const combined = [...(dto.imageUrls ?? []), ...uploaded];
    if (combined.length > 5) {
      throw new BadRequestException("You can attach up to 5 images");
    }
    return this.svc.update(id, {
      ...dto,
      ...(files?.length || dto.imageUrls ? { imageUrls: combined } : {})
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }

  @Post(":id/pause")
  pause(@Param("id") id: string) {
    return this.svc.pause(id);
  }

  @Post(":id/resume")
  resume(@Param("id") id: string) {
    return this.svc.resume(id);
  }

  private async uploadImages(files: UploadedImageFile[]): Promise<string[]> {
    if (!files.length) return [];

    for (const file of files) {
      if (!file.mimetype?.startsWith("image/")) {
        throw new BadRequestException("Only image files are allowed");
      }
    }

    const tenantId = this.ctx.requireTenantId();
    const urls: string[] = [];
    for (const file of files) {
      urls.push(await this.cloudinary.uploadScheduleImage(file, tenantId));
    }
    return urls;
  }
}
