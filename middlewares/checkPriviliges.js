export default function checkPriviliges(...roles) {
  return (req, res, next) => {
    const { userRole } = res.locals;

    if (res.locals.userRole === 'unapproved') {
      console.log(`checkPriviliges middleware INFO: Unapproved user access attempt: ${res.locals.username}!`);
      return res
        .status(403)
        .render('error', { message: "Your account hasn't yet been approved by a system administrator" });
    }

    if (roles.includes(userRole)) {
      return next();
    }

    console.log(`checkPriviliges middleware INFO: Permission denied for ${res.locals.username}!`);
    return res.status(403).render('error', { message: 'Permission denied.' });
  };
}
