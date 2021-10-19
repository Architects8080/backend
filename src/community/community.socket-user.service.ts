import { Scope } from '@nestjs/common';
import { SocketUserService } from 'src/socket/socket-user.service';

export const COMMUNITY_SOCKET_USER_SERVICE_PROVIDER =
  'COMMUNITY_SOCKET_USER_SERVICE';

export const CommunitySocketUserService = {
  provide: COMMUNITY_SOCKET_USER_SERVICE_PROVIDER,
  useClass: SocketUserService,
  scope: Scope.DEFAULT,
};
