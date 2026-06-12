import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger("Bootstrap");

  app.use(helmet());
  app.enableCors({
    origin: process.env.CLIENT_URL?.split(",") ?? "*",
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const port = parseInt(process.env.PORT || "3000", 10);
  await app.listen(port);
  logger.log(`WA-Scheduler backend listening on :${port}`);
}

bootstrap();
