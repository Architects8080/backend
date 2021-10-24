import { Inject, Injectable } from '@nestjs/common';
import { SocketUserService } from 'src/socket/socket-user.service';
import { UserStatus } from '../data/user-status';
import { COMMUNITY_SOCKET_USER_SERVICE_PROVIDER } from '../socket-user/community.socket-user.service';

@Injectable()
export class StatusService {
  constructor(
    @Inject(COMMUNITY_SOCKET_USER_SERVICE_PROVIDER)
    private communitySocketUserService: SocketUserService,
  ) {}

  userMap: Map<number, UserStatus> = new Map();
  listenerList: ((id: number, status: UserStatus) => void)[] = [];

  getUserStatusById(id: number): UserStatus {
    const status = this.userMap.get(id);
    if (status) return this.userMap.get(id);
    return UserStatus.OFFLINE;
  }

  setUserStatusById(id: number, status: UserStatus) {
    const isPlaying = this.getUserStatusById(id) == UserStatus.PLAYING;
    if (isPlaying) {
      if (this.communitySocketUserService.getSocketById(id))
        status = UserStatus.ONLINE;
      else status = UserStatus.OFFLINE;
    }
    if (this.getUserStatusById(id) != status)
      this.listenerList.forEach((l) => {
        l(id, status);
      });
    this.userMap.set(id, status);
  }

  addListener(listener: (id: number, status: UserStatus) => void) {
    this.listenerList.push(listener);
  }
}
