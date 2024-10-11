import jwt from 'jsonwebtoken';

const JWT_SECRET = 'suPerSEcReT';

export default function userInfo(req, res, next) {
  res.locals.username = null;
  res.locals.userRole = null;
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        res.locals.username = decoded.username;
        res.locals.userRole = decoded.role;
      }
    });
  }
  next();
}
