import { Injectable } from '@nestjs/common';
import { GamePlayer } from './data/game-player.data';
import { GameStatus } from './data/game-status.data';
import { GameInfo } from './data/gameinfo.data';
import { GameRoom } from './data/gameroom.data';
import { GameRepository } from './game.repository';

@Injectable()
export class GameService {
  constructor(private gameRepository: GameRepository) {}

  invite(userId: number, targetUserId: number): number {
    const gameRoom = this.gameRepository.createGameRoom();

    gameRoom.player1 = { id: userId, isAccept: true };
    gameRoom.player2 = { id: targetUserId, isAccept: false };
    return gameRoom.socketRoomId;
  }

  accept(userId: number, roomId: number) {
    const gameRoom = this.gameRepository.getGameRoom(roomId);

    if (gameRoom.player1.id == userId) gameRoom.player1.isAccept = true;
    if (gameRoom.player2.id == userId) gameRoom.player2.isAccept = true;
    if (gameRoom.player1.isAccept && gameRoom.player2.isAccept) return gameRoom;
    return;
  }

  cancel(userId: number, roomId: number) {
    const gameRoom = this.gameRepository.getGameRoom(roomId);

    let canceledPlayerId;
    if (gameRoom.player1.id == userId) canceledPlayerId = gameRoom.player2.id;
    else if (gameRoom.player2.id == userId)
      canceledPlayerId = gameRoom.player1.id;
    else return;
    this.gameRepository.deleteGameRoom(roomId);
    return canceledPlayerId;
  }

  private gameLoop(
    room: GameRoom,
    onUpdate: (gameInfo: GameInfo) => any,
    onFinish?,
  ) {
    return () => {
      //some calc
      onUpdate(room.gameInfo);
      if (room.gameStatus == GameStatus.FINISHED) {
        clearInterval(room.interval);
        onFinish();
        this.gameRepository.saveGameToDB(room.socketRoomId);
        this.gameRepository.deleteGameRoom(room.socketRoomId);
      }
    };
  }

  start(roomId: number, onUpdate: (gameInfo: GameInfo) => any) {
    const gameRoom = this.gameRepository.getGameRoom(roomId);
    const gameInfo = new GameInfo();

    const canvasWidth = 800;
    const canvasHeight = 600;

    const paddleWidth = 10;
    const paddleHeight = 75;
    const paddleY = (canvasHeight - paddleHeight) / 2;

    gameInfo.ball = { position: { x: canvasWidth / 2, y: canvasHeight / 2 }, vector: { dx: 0, dy: 0 } };
    gameInfo.player1 = {
      id: gameRoom.player1.id,
      position: { x: 0 + paddleWidth, y: paddleY },
      vector: { dx: 0, dy: 0 },
      score: 0,
    };
    gameInfo.player2 = {
      id: gameRoom.player2.id,
      position: { x: canvasWidth - paddleWidth * 2, y: paddleY },
      vector: { dx: 0, dy: 0 },
      score: 0,
    };
    gameRoom.gameInfo = gameInfo;
    gameRoom.gameStatus = GameStatus.STARTED;
    gameRoom.interval = setInterval(this.gameLoop(gameRoom, onUpdate), 10);
  }

  private movePlayer(gamePlayer: GamePlayer, moveInfo: any) {
    console.log(gamePlayer.id, "move!!");
    gamePlayer.position.y += moveInfo;
  }

  move(roomId: number, playerId: number, moveInfo: any) {

    const gameRoom = this.gameRepository.getGameRoom(roomId);

    if (!gameRoom || gameRoom.gameStatus != GameStatus.STARTED) return;
    if (gameRoom.player1.id == playerId)
      this.movePlayer(gameRoom.gameInfo.player1, moveInfo);
    if (gameRoom.player2.id == playerId)
      this.movePlayer(gameRoom.gameInfo.player2, moveInfo);
  }
}
