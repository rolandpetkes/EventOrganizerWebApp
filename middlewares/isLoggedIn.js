export default function isLoggedIn(req, res, next) {
  if (!res.locals.username) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(401).json();
    }
    return res.redirect('/login');
  }
  console.log('isLoggedIn middleware INFO: User is logged in');
  return next();
}
