import { Inject, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { cookieExtractor, JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { SocketUser } from 'src/socket/socket-user';
import { GameInfo } from './data/gameinfo.data';
import { GameService } from './game.service';
import { SocketUserService } from '../socket/socket-user.service';
import { GameRoomService } from './game-room.service';
import { GamePlayer } from './data/game-player.data';
import { MatchmakerService } from './matchmaker/matchmaker.service';
import { User } from 'src/user/entity/user.entity';
import { UserStatus } from 'src/community/data/user-status';
import { UserService } from 'src/user/user.service';
import { StatusService } from 'src/community/status/status.service';
import { serialize } from 'class-transformer';

@UseGuards(JwtAuthGuard)
@WebSocketGateway(4000, { namespace: 'game' })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private jwtService: JwtService,
    private jwtStrategy: JwtStrategy,
    private gameService: GameService,
    private gameRoomService: GameRoomService,
    @Inject('GAME_SOCKET_USER_SERVICE')
    private socketUserService: SocketUserService,
    private matchmakerService: MatchmakerService,
    private userService: UserService,
    private statusService: StatusService,
  ) {}

  @WebSocketServer()
  server: Server;

  async handleConnection(client: SocketUser, ...args: any[]) {
    console.log('Client Connected');
    try {
      const token = cookieExtractor(client); //error
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
      const existUser = this.socketUserService.getSocketById(user.id);
      if (existUser) {
        existUser.rooms.forEach((room) => {
          client.join(room);
        });
        existUser.disconnect(true);
      } else {
        const room = this.gameRoomService.getJoinedRoom(user.id);
        if (room) client.join('gameroom:' + room);
      }
      this.socketUserService.addSocket(client);
    } catch (error) {
      console.log(`[Game Gateway] : `, error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: SocketUser) {
    console.log('Client Disconnected');
    try {
      const token = cookieExtractor(client);
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
      this.matchmakerService.removeWaiting(user);
      this.clearReadyRoom(user);
      this.socketUserService.removeSocket(client);
    } catch (error) {}
  }

  clearReadyRoom(user: User) {
    this.gameRoomService
      .getReadyRoomListByUser(user.id)
      .forEach((roomId: number) => {
        const targetId = this.gameRoomService.cancel(user.id, roomId);
        const target = this.socketUserService.getSocketById(targetId);
        this.matchmakerService.rejectedMatch(target.user);
        if (target) target.emit('cancel', roomId);
      });
  }

  @SubscribeMessage('invite')
  inviteGame(
    @MessageBody() data: any[],
    @ConnectedSocket() client: SocketUser,
  ) {
    const targetUserId = data[0];
    const mapSetting = data[1];
    const targetUser = this.socketUserService.getSocketById(targetUserId);
    const clientUser = JSON.parse(serialize(client.user));
    // queue에서 대기중인 경우 초대를 못 보내게 합니다.
    if (this.matchmakerService.isWaiting(client.user)) return;
    if (targetUser) {
      const roomId: number = this.gameRoomService.invite(
        clientUser.id,
        targetUser.user.id,
        mapSetting,
      );
      // 보낸 대상이 queue에서 대기중인 경우 바로 거절되도록 합니다.
      if (this.matchmakerService.isWaiting(targetUser.user)) {
        this.gameRoomService.cancel(targetUser.user.id, roomId);
        client.emit('cancel', roomId);
        return;
      }
      targetUser.emit(
        'invite',
        clientUser.nickname,
        clientUser.avatar,
        roomId,
        false,
      );
    }
  }

  @SubscribeMessage('observe')
  observeGame(
    @MessageBody() data: any[],
    @ConnectedSocket() client: SocketUser,
  ) {
    const roomId = +data[0];
    if (this.gameRoomService.isPlayingRoom(roomId)) {
      client.join('gameroom:' + roomId.toString());
    } else {
      client.emit('vanished', roomId.toString());
    }
  }

  @SubscribeMessage('accept')
  acceptGame(
    @MessageBody() data: any[],
    @ConnectedSocket() client: SocketUser,
  ) {
    const roomId = data[0];
    const acceptedRoom = this.gameRoomService.accept(client.user.id, roomId);

    if (acceptedRoom) {
      const player1 = this.socketUserService.getSocketById(
        acceptedRoom.player1.id,
      );
      const player2 = this.socketUserService.getSocketById(
        acceptedRoom.player2.id,
      );

      if (!player1 || !player2) {
        // exception
      }

      player1.emit('ready', roomId);
      player2.emit('ready', roomId);

      player1.join('gameroom:' + roomId.toString());
      player2.join('gameroom:' + roomId.toString());
      this.gameService.start(
        roomId,
        (gameInfo: GameInfo) => {
          this.server
            .in('gameroom:' + roomId.toString())
            .emit('update', roomId, gameInfo);
        },
        async (gameInfo: GameInfo) => {
          let winner: GamePlayer;
          let loser: GamePlayer;
          if (gameInfo.player1.score >= gameInfo.player2.score) {
            winner = gameInfo.player1;
            loser = gameInfo.player2;
          } else {
            winner = gameInfo.player2;
            loser = gameInfo.player1;
          }
          let winnerUser = await this.userService.getUserById(winner.id);
          winnerUser = JSON.parse(serialize(winnerUser));
          this.statusService.setUserStatusById(
            gameInfo.player1.id,
            UserStatus.ONLINE,
          );
          this.statusService.setUserStatusById(
            gameInfo.player2.id,
            UserStatus.ONLINE,
          );
          this.server
            .in('gameroom:' + roomId.toString())
            .emit('gameover', roomId, {
              winnerProfile: {
                nickname: winnerUser.nickname,
                avatar: winnerUser.avatar,
              },
              score: {
                winnerScore: winner.score,
                loserScore: loser.score,
              },
            });
        },
      );
      this.matchmakerService.removeWaiting(player1.user);
      this.matchmakerService.removeWaiting(player2.user);
      this.clearReadyRoom(player1.user);
      this.clearReadyRoom(player2.user);
      this.statusService.setUserStatusById(player1.user.id, UserStatus.PLAYING);
      this.statusService.setUserStatusById(player2.user.id, UserStatus.PLAYING);
    }
  }

  @SubscribeMessage('cancel')
  cancelGame(
    @MessageBody() data: any[],
    @ConnectedSocket() client: SocketUser,
  ) {
    const roomId = data[0];
    const canceledPlayerId = this.gameRoomService.cancel(
      client.user.id,
      roomId,
    );
    const canceledPlayer =
      this.socketUserService.getSocketById(canceledPlayerId);
    if (this.matchmakerService.isWaiting(client.user)) {
      this.matchmakerService.removeWaiting(client.user);
      if (canceledPlayer)
        this.matchmakerService.rejectedMatch(canceledPlayer.user);
    }
    if (canceledPlayer) canceledPlayer.emit('cancel', roomId);
  }

  @SubscribeMessage('joinQueue')
  joinQueue(@MessageBody() data: any[], @ConnectedSocket() client: SocketUser) {
    if (!this.matchmakerService.isWaiting(client.user))
      this.clearReadyRoom(client.user);
    this.matchmakerService.addWaiting(client.user);
  }

  @SubscribeMessage('leaveQueue')
  leaveQueue(
    @MessageBody() data: any[],
    @ConnectedSocket() client: SocketUser,
  ) {
    this.matchmakerService.removeWaiting(client.user);
  }

  @SubscribeMessage('move')
  movePlayer(
    @MessageBody() data: any[],
    @ConnectedSocket() client: SocketUser,
  ) {
    const roomId = +data[0];
    const moveInfo = data[1];

    this.gameService.move(roomId, client.user.id, moveInfo);
  }
}
