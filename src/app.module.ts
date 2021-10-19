import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from 'config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtMiddleware } from './auth/middleware/jwt.middleware';
import { UserModule } from './user/user.module';
import { GameModule } from './game/game.module';
import { OTPModule } from './otp/otp.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { MatchModule } from './match/match.module';
import { DmModule } from './dm/dm.module';
import { CommunityModule } from './community/community.module';
import { ChannelModule } from './channel/channel.module';
import { AchievementModule } from './achievement/achievement.module';
import { NotificationModule } from './notification/notification.module';
import { FriendModule } from './friend/friend.module';
import { BlockModule } from './block/block.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AuthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.user'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: ['dist/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
    }),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => [
        {
          rootPath: configService.get<string>('public.path'),
          serveRoot: configService.get<string>('public.route'),
        },
      ],
    }),
    UserModule,
    GameModule,
    OTPModule,
    MatchModule,
    DmModule,
    CommunityModule,
    ChannelModule,
    AchievementModule,
    NotificationModule,
    FriendModule,
    BlockModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtMiddleware).forRoutes('*');
  }
}
