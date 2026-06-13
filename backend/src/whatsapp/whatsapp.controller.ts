import { Controller, Delete, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('status')
  status(@Request() req: any) {
    return this.whatsappService.getStatus(req.user.id);
  }

  @Post('connect')
  async connect(@Request() req: any) {
    await this.whatsappService.connect(req.user.id, true);
    return { message: 'Connecting...' };
  }

  @Delete('disconnect')
  async disconnect(@Request() req: any) {
    await this.whatsappService.disconnect(req.user.id);
    return { message: 'Disconnected' };
  }

  @Post('sync-groups')
  async syncGroups(@Request() req: any) {
    const groups = await this.whatsappService.syncGroups(req.user.id);
    return { groups };
  }
}
