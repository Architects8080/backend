import { Inject, Injectable } from '@nestjs/common';
import { serialize } from 'class-transformer';
import { PriorityQueue } from 'src/lib/priority-queue';
import { SocketUserService } from 'src/socket/socket-user.service';
import { User } from 'src/user/entity/user.entity';
import { GameType } from '../data/game-type.data';
import { GameRepository } from '../game.repository';
import { WaitingUser } from './waiting-user';

@Injectable()
export class MatchmakerService {
  private waitingQueue: PriorityQueue<WaitingUser>;
  private waitingUserMap: Map<number, WaitingUser>;

  constructor(
    private gameRepository: GameRepository,
    @Inject('GAME_SOCKET_USER_SERVICE')
    private socketUserService: SocketUserService,
  ) {
    this.waitingQueue = new PriorityQueue(
      (arg1, arg2) => arg1.waitingAt < arg2.waitingAt,
    );
    this.waitingUserMap = new Map();
    setInterval(this.loop(), 10);
  }

  sendInviteRoom(userId: number, targetId: number, roomId: number) {
    const userSocket = this.socketUserService.getSocketById(userId);
    const targetSocket = this.socketUserService.getSocketById(targetId);

    const user: User = JSON.parse(serialize(userSocket.user));
    const target: User = JSON.parse(serialize(targetSocket.user));

    if (user && target) {
      targetSocket.emit('invite', user.nickname, user.avatar, roomId, true);
      userSocket.emit('invite', target.nickname, target.avatar, roomId, true);
      return true;
    }
    return false;
  }

  loop() {
    return () => {
      const failedUserList = [];
      while (this.waitingQueue.heap.length > 0) {
        const user = this.waitingQueue.pop();
        if (!user) return;
        for (const target of this.waitingQueue.heap) {
          if (Math.abs(user.ladderPoint - target.ladderPoint) < 100) {
            user.hasRoom = true;
            target.hasRoom = true;
            const room = this.gameRepository.createGameRoom();
            room.player1 = { id: user.userId, isAccept: false };
            room.player2 = { id: target.userId, isAccept: false };
            room.isObstacle = false;
            room.mapType = 1;
            room.gameType = GameType.LADDER;
            if (
              this.sendInviteRoom(user.userId, target.userId, room.socketRoomId)
            ) {
              this.waitingQueue.remove(target);
              break;
            }
            target.hasRoom = false;
            this.gameRepository.deleteGameRoom(room.socketRoomId);
          }
        }
        // 매칭에 실패한 경우
        if (!user.hasRoom) failedUserList.push(user);
      }
      failedUserList.forEach((user) => {
        this.waitingQueue.push(user);
      });
    };
  }

  addWaiting(user: User) {
    if (this.isWaiting(user)) return;
    const waitingUser: WaitingUser = {
      hasRoom: false,
      userId: user.id,
      ladderPoint: user.ladderPoint,
      waitingAt: new Date(),
    };
    this.waitingUserMap.set(user.id, waitingUser);
    this.waitingQueue.push(waitingUser);
  }

  // 매칭이 더 이상 필요 없을 때 호출
  // 매칭 거절을 누른 경우, 게임이 시작한 경우
  removeWaiting(user: User) {
    const existUser = this.waitingUserMap.get(user.id);
    if (existUser) {
      this.waitingQueue.remove(existUser);
      this.waitingUserMap.delete(user.id);
    }
  }

  // 매칭에서 거절당했을 때 호출 합니다.
  rejectedMatch(user: User) {
    const existUser = this.waitingUserMap.get(user.id);
    if (existUser && existUser.hasRoom) {
      existUser.hasRoom = false;
      this.waitingQueue.push(existUser);
    }
  }

  isWaiting(user: User): boolean {
    const existUser = this.waitingUserMap.get(user.id);
    return existUser != undefined;
  }
}
