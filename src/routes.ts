import dayjs from "dayjs"
import { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "./lib/prisma"

export async function appRoutes(app: FastifyInstance) {
  app.post("/habits", async (request) => {
    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(z.number().min(0).max(6)),
    })

    const { title, weekDays } = createHabitBody.parse(request.body)

    const today = dayjs().startOf("day").toDate()

    await prisma.habit.create({
      data: {
        title,
        created_at: today,
        weekDays: {
          create: weekDays.map((weekDay) => {
            return {
              week_day: weekDay,
            }
          }),
        },
      },
    })
  })

  app.get("/day", async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date(),
    })
    const { date } = getDayParams.parse(request.query)

    const parsedDate = dayjs(date).startOf("day")
    const weekDay = dayjs(date).get("day")

    //todos habitos possiveis
    //habitos que ja foram completados

    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at: {
          lte: date,
        },
        weekDays: {
          some: {
            week_day: weekDay,
          },
        },
      },
    })
    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate(),
      },
      include: {
        dayHabits: true,
      },
    })
    const completedHabits = day?.dayHabits.map((dayHabit) => {
      return dayHabit.habit_id
    })
    console.log(
      "🚀 ~ file: routes.ts:67 ~ completedHabits ~ completedHabits",
      completedHabits
    )
    return {
      possibleHabits,
      completedHabits,
    }
  })

  app.patch("/habits/:id/toggle", async (request) => {
    //rota para completar ou descompletar o hábito
    const toggleHabitParams = z.object({
      id: z.string().uuid(),
    })

    const { id } = toggleHabitParams.parse(request.params)

    const today = dayjs().startOf("day").toDate()

    let day = await prisma.day.findUnique({
      where: {
        date: today,
      },
    })

    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today,
        },
      })
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id,
        },
      },
    })

    if (dayHabit) {
      //remover a marcação de completo
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id,
        },
      })
    } else {
      //completar o habito
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id,
        },
      })
    }
  })

  app.get("/summary", async (request) => {
    // query mais complexa, mais condições - sql na mão ( raw sql)
    //sqlite
    //* SUB QUERY ( UMA QUERY DENTRO DE OUTRA ) */
    const summary = await prisma.$queryRaw`
      SELECT 
        D.id,
        D.date,
        (
          SELECT 
            cast(count(*) as float)
          FROM day_habits DH
          WHERE DH.day_id = D.id
        ) as completed,
        (
          SELECT
            cast(count(*) as float)
          FROM habit_week_days HWD
          JOIN habits H
            ON H.id = HWD.habit_id
          WHERE
            HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
            AND H.created_at <=D.date
        ) as amount
      FROM days D
    `
    return summary
  })
}
