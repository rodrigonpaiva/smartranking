import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { tenancyContext } from '../tenancy/tenancy.context';
import { Model } from 'mongoose';
import { Club } from '../clubs/interfaces/club.interface';
import { Category } from '../categories/interfaces/category.interface';
import { Player } from '../players/interfaces/players.interface';

const SEED_TENANT = process.env.SEED_TENANT ?? 'default';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const clubModel = app.get<Model<Club>>(getModelToken('Club'));
  const categoryModel = app.get<Model<Category>>(getModelToken('Category'));
  const playerModel = app.get<Model<Player>>(getModelToken('Player'));

  await tenancyContext.run(
    {
      tenant: SEED_TENANT,
      allowMissingTenant: false,
      disableTenancy: false,
    },
    async () => {
      const existingClub = await clubModel.findOne({ slug: 'sample-club' });
      if (existingClub) {
        console.log('Seed data already exists, skipping.');
        return;
      }

      const club = await clubModel.create({
        name: 'Sample Club',
        slug: 'sample-club',
        city: 'São Paulo',
        state: 'SP',
      });

      const players = await playerModel.create(
        ['Alice', 'Bruno', 'Carla', 'Diego'].map((name, index) => ({
          name,
          email: `${name.toLowerCase()}@example.com`,
          phone: `1198000000${index + 1}`,
          clubId: club._id,
        })),
      );

      const category = await categoryModel.create({
        category: 'A',
        description: 'Local ladder',
        clubId: club._id,
        players: players.map((player) => player._id),
      });

      console.log('Seeded data:');
      console.log(`- Club: ${club.name} (${club._id.toString()})`);
      console.log(
        `- Category: ${category.category} (${category._id.toString()})`,
      );
      players.forEach((player) =>
        console.log(`- Player: ${player.name} (${player._id.toString()})`),
      );
    },
  );

  await app.close();
}

bootstrap().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});
