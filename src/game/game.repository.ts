import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';
import { GamePlayer } from './data/game-player.data';
import { GameStatus } from './data/game-status.data';
import { GameRoom } from './data/gameroom.data';
import { MatchPlayer } from '../match/entity/match-player.entity';
import { Match } from '../match/entity/match.entity';
import { GameType } from './data/game-type.data';
import { User } from 'src/user/entity/user.entity';

@Injectable()
export class GameRepository {
  // need typeorm
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(MatchPlayer)
    private matchPlayerRepository: Repository<MatchPlayer>,
    private userService: UserService,
  ) {}

  gameRoomMap: Map<number, GameRoom> = new Map();

  private generateRoomId(): number {
    let id = 0;
    while (id == 0 || this.gameRoomMap.has(id)) {
      const max = 1000;
      const min = 100;
      id = Math.floor(Math.random() * (max - min)) + min;
    }
    return id;
  }

  getGameRoom(roomId: number): GameRoom {
    return this.gameRoomMap.get(roomId);
  }

  createGameRoom(): GameRoom {
    const instance = new GameRoom();
    const socketRoomId = this.generateRoomId();

    instance.socketRoomId = socketRoomId;
    instance.gameStatus = GameStatus.READY;
    this.gameRoomMap.set(socketRoomId, instance);
    return instance;
  }

  deleteGameRoom(roomId: number) {
    return this.gameRoomMap.delete(roomId);
  }

  updateGameRoom(roomId: number, gameRoom: GameRoom) {
    return this.gameRoomMap.set(roomId, gameRoom);
  }

  async saveMatchPlayer(
    matchId: number,
    user: User,
    player: GamePlayer,
    isLeft: boolean,
    isWinner: boolean,
    ladderIncrease: number,
  ) {
    const matchPlayer = this.matchPlayerRepository.create();
    matchPlayer.matchId = matchId;
    matchPlayer.userId = player.id;
    matchPlayer.score = player.score;
    matchPlayer.isLeft = isLeft;
    matchPlayer.ladderPoint = user.ladderPoint;
    matchPlayer.ladderIncrease = ladderIncrease;
    matchPlayer.isWinner = isWinner;
    this.matchPlayerRepository.insert(matchPlayer);
    if (matchPlayer.ladderIncrease) {
      user.ladderPoint += ladderIncrease;
      this.userService.updateUser(user);
    }
  }

  getEstimated(ratingDiff: number) {
    // 예상 승률
    return Number((1 / (1 + Math.pow(10, ratingDiff / 400))).toFixed(2));
  }

  calcPointIncrease(
    gameType: GameType,
    isWinner: boolean,
    me: User,
    enemy: User,
  ): number {
    if (gameType == GameType.CUSTOM) return 0;
    // 점수 변동 상수
    const K = 20;
    const winning = isWinner ? 1 : 0;
    const estimated = this.getEstimated(
      Math.abs(me.ladderPoint - enemy.ladderPoint),
    );
    return Math.round(K * (winning - estimated));
  }

  async saveGameToDB(roomId: number) {
    const room = this.getGameRoom(roomId);
    if (!room) return null;
    const gameInfo = room.gameInfo;
    const match: Match = this.matchRepository.create();
    const gameTime =
      (gameInfo.endAt.getTime() - gameInfo.startAt.getTime()) / 1000;
    const isPlayer1Win = gameInfo.player1.score > gameInfo.player2.score;
    match.startAt = gameInfo.startAt;
    match.endAt = gameInfo.endAt;
    match.gameTime = Math.round(gameTime);
    match.gameType = room.gameType;

    const player1User = await this.userService.getUserById(gameInfo.player1.id);
    const player2User = await this.userService.getUserById(gameInfo.player2.id);

    const player1PointIncrease = this.calcPointIncrease(
      match.gameType,
      isPlayer1Win,
      player1User,
      player2User,
    );
    const player2PointIncrease = this.calcPointIncrease(
      match.gameType,
      !isPlayer1Win,
      player2User,
      player1User,
    );
    await this.matchRepository.insert(match);
    this.saveMatchPlayer(
      match.id,
      player1User,
      gameInfo.player1,
      true,
      isPlayer1Win,
      player1PointIncrease,
    );
    this.saveMatchPlayer(
      match.id,
      player2User,
      gameInfo.player2,
      false,
      !isPlayer1Win,
      player2PointIncrease,
    );
  }
}
