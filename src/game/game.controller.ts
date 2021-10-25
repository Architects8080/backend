import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { mapList } from './data/gamemap.data';
import { GameRoomService } from './game-room.service';
import { GameService } from './game.service';

@UseGuards(JwtAuthGuard)
@Controller('game')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly gameRoomService: GameRoomService) {}

  //return string array
  @Get('map/list')
  getUsers() {
    return mapList;
  }

  //maybe use..
  @Get('map/:mapId')
  getUserById(@Param('mapId', ParseIntPipe) id: number) {
    return mapList[id];
  }

  @Get('gameroom/:userId')
  getGameroomById(@Param('userId', ParseIntPipe) id: number) {
    return this.gameRoomService.getJoinedRoom(id);
  }
}
