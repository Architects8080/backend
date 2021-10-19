import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { NotificationService } from './notification.service';

@UseGuards(JwtAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  getNotificationList(@Req() req) {
    return this.notificationService.getNotifications(req.user.id);
  }

  @Post('accept/:notiId')
  acceptNotification(
    @Req() req,
    @Param('notiId', ParseIntPipe) notiId: number,
  ) {
    return this.notificationService.acceptNotification(req.user.id, notiId);
  }

  @Delete(':notiId')
  refuseNotification(
    @Req() req,
    @Param('notiId', ParseIntPipe) notiId: number,
  ) {
    return this.notificationService.refuseNotification(req.user.id, notiId);
  }
}
