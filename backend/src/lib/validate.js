import { z } from 'zod'

export const portfolioAddSchema = z.object({
  ticker: z.string().min(1).max(10).transform(v => v.toUpperCase()),
  shares: z.number().positive(),
  avgCost: z.number().positive()
})

export const macroSchema = z.object({
  type: z.enum(['CDS', 'VIX', 'FAIZ', 'ENFLASYON']),
  value: z.number(),
  note: z.string().optional()
})

export const signalCalcSchema = z.object({
  ticker: z.string().min(1).max(10).transform(v => v.toUpperCase())
})

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message })
  }
  req.body = result.data
  next()
}
