import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";
import { TenantContext } from "./tenant-context";
import { CloudinaryService } from "./cloudinary.service";

@Global()
@Module({
  providers: [CryptoService, TenantContext, CloudinaryService],
  exports: [CryptoService, TenantContext, CloudinaryService]
})
export class CommonModule {}
