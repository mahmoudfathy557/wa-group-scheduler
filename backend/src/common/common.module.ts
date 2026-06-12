import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";
import { TenantContext } from "./tenant-context";

@Global()
@Module({
  providers: [CryptoService, TenantContext],
  exports: [CryptoService, TenantContext]
})
export class CommonModule {}
