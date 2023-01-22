import Fastify from "fastify"
import cors from "@fastify/cors"
import { appRoutes } from "./routes"

const app = Fastify()

app.register(cors)
app.register(appRoutes)

app
  .listen({
    port: 3334,
    // host: "0.0.0.0", // pra funfar no mobile
  })
  .then(() => console.log(`server running `))
