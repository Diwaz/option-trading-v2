import rateLimit from "express-rate-limit"


export const PerMinRateLimit = rateLimit({
    windowMs:60*1000,
    limit:30,
})