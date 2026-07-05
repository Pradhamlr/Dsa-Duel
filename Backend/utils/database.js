import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['error'],
  errorFormat: 'minimal'
})

export async function withPrisma(callback) {
  return callback(prisma)
}

export { prisma }
