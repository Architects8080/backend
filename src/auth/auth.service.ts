import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/entity/user.entity';
import { UserService } from 'src/user/user.service';
import { LoginResult } from './data/login-result.data';
import { JwtDto } from './dto/jwt.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async sign({ id }, valid: boolean = true) {
    const payload = { id: id, valid: valid };
    return this.jwtService.sign(payload);
  }

  async login(user: any, session: Record<string, User>): Promise<LoginResult> {
    try {
      const exist = await this.userService.getUserById(user.id);
      if (exist) {
        const token = await this.sign(exist, exist.otpSecret == null);
        return { token: token, user: exist };
      }
    } catch (error) {}

    const newUser = new User();
    newUser.id = user.id;
    newUser.nickname = user.login;
    newUser.intraLogin = user.login;
    newUser.avatar = user.image_url;
    newUser.ladderLevel = 0;
    newUser.ladderPoint = 0;

    //임시 session에 유저 저장
    session.newUser = newUser;
    return null;
  }

  //register 이후에 jwt 리턴
  async register(nickname: string, session: any) {
    session.newUser.nickname = nickname;
    if (!session.newUser.nickname)
      session.newUser.nickname = session.newUser.intraLogin;
    await this.userService.createUser(session.newUser);

    return this.login(session.newUser, session); // will return jwt
  }

  //jwt validate
  async validate(user: JwtDto) {
    return await this.userService.getUserById(user.id);
  }
}
