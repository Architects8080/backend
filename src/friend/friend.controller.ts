import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Friend } from './entity/friend.entity';
import { FriendService } from './friend.service';

@UseGuards(JwtAuthGuard)
@Controller('friend')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Get()
  getFriendList(@Req() req) {
    return this.friendService.getFriendList(req.user.id);
  }

  @Post(':friendId')
  requestFriend(@Req() req, @Param('friendId', ParseIntPipe) friendId: number) {
    return this.friendService.requestFriend({
      userId: req.user.id,
      otherId: friendId,
    });
  }

  @Delete(':friendId')
  deleteFriend(@Req() req, @Param('friendId', ParseIntPipe) friendId: number) {
    return this.friendService.deleteFriend({
      userId: req.user.id,
      otherId: friendId,
    });
  }

  @Get(':friendId')
  async getFriendById(
    @Req() req,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    const response = await this.friendService.getFriendById({
      userId: req.user.id,
      otherId: friendId,
    });
    if (response) return response;
    throw new NotFoundException();
  }
}
