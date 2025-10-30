import { PrismaClient } from '@prisma/client'

export async function withPrisma(callback) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: ['error'],
    errorFormat: 'minimal'
  })
  
  try {
    return await callback(prisma)
  } finally {
    await prisma.$disconnect()
  }
}