import { safeFetch } from '@itterno/fault/fetch'
import { safeZodParse } from '@itterno/fault/zod'
import { z } from 'zod'

const userSchema = z.object({ name: z.string(), age: z.number().min(18) })

const result = await safeFetch('https://api.example.com/users/1').andThen(safeZodParse(userSchema))

result.match(
  (data) => console.log(data),
  (error) => console.error(error.toJSON()),
)
