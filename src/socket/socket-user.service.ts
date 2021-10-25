import { ConflictException, Injectable } from '@nestjs/common';
import { SocketUser } from 'src/socket/socket-user';

@Injectable()
export class SocketUserService {
  private socketUser: Map<number, SocketUser> = new Map();

  // mutable object;
  getAllSocket() {
    return this.socketUser;
  }

  getSocketById(id: number): SocketUser {
    return this.socketUser.get(id);
  }

  addSocket(socket: SocketUser) {
    // if (this.socketUser.has(socket.user.id))
    //   throw new ConflictException(); //TODO: how to block user?
    // else
      this.socketUser.set(socket.user.id, socket);
  }

  removeSocket(socket: SocketUser) {
    this.socketUser.delete(socket.user.id);
  }

  removeSocketById(id: number) {
    this.socketUser.delete(id);
  }
}
