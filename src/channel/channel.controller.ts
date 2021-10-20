import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/channel/guard/roles.decorator';
import { RolesGuard } from 'src/channel/guard/roles.guard';
import { ChannelService } from './channel.service';
import { ChannelType } from './channel.type';
import { CreateChannelDto } from './dto/create-channel.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('channel')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Get()
  async getAllChannel() {
    const allChannels = await this.channelService.getAllChannel();
    return allChannels.filter((channel) => channel.type !== ChannelType.PRIVATE);
  }

  @Get('me')
  async getMyChannel(@Req() req) {
    return await this.channelService.getMyChannel(req.user.id);
  }

  @Get(':id')
  getChannelById(@Param('id', ParseIntPipe) roomId: number) {
    return this.channelService.getChannelById(roomId);
  }

  @Get('/members/:id')
  async getChannelMember(@Param('id', ParseIntPipe) roomId: number) {
    return this.channelService.getChannelMember(roomId);
  }

  @Post('enter-pw')
  async login(@Body() req) {
    return this.channelService.checkPassword(req.userId, req.roomId, req.password);
  }

  @Post('create')
  async createChannel(
    @Body() createData: CreateChannelDto,
  ) {
    return await this.channelService.createChannel(createData);
  }

  @Put('update/:id')
  @Roles('owner')
  async updateChannel(
    @Param('id') roomId: number,
    @Body() updateData: UpdateChannelDto,
  ) {
    return await this.channelService.updateChannel(roomId, updateData);
  }

  @Post('invite/:id')
  async inviteMember(
    @Param('id', ParseIntPipe) roomId: number,
    @Body() inviteData: InviteMemberDto,
  ) {
    return await this.channelService.inviteMember(roomId, inviteData);
  }
}
