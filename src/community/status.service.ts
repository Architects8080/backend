import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CommunityGateway } from './community.gateway';
import { UserStatus } from './data/user-status';

@Injectable()
export class StatusService {
  constructor(
    @Inject(forwardRef(() => CommunityGateway))
    private communityGateway: CommunityGateway,
  ) {}

  userMap: Map<number, UserStatus> = new Map();

  getUserStatusById(id: number): UserStatus {
    const status = this.userMap.get(id);
    if (status) return this.userMap.get(id);
    return UserStatus.OFFLINE;
  }

  setUserStatusById(id: number, status: UserStatus) {
    this.userMap.set(id, status);
    this.communityGateway.server
      .to(`user:${id.toString()}`)
      .emit('chagneUserStatus', id, status);
  }
}
