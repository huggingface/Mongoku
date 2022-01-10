import { Request, Response, NextFunction } from 'express';

const MONGOKU_READ_ONLY_MODE = process.env.MONGOKU_READ_ONLY_MODE === 'true';

export function readOnlyMode(_: Request, res: Response, next: NextFunction) {
    if (MONGOKU_READ_ONLY_MODE) {
        res.sendStatus(401);
    } else {
        next();
    }
}
