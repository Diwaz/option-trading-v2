
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";



declare global {
  namespace Express {
    interface Request {
      user?:  {
        userId: string;
      };
    }
  }
}


export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) ;

    if(!req.user) req.user = {}
    req.user.userId = payload.userId; 

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
