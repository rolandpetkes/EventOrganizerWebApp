import dbCommands from '../db/db_commands.js';

export default async function ownsEntity(req, res, next) {
  let eventID;
  if (req.body.eventID) {
    eventID = req.body.eventID;
  } else {
    eventID = req.params.eventID;
  }
  let event;
  try {
    event = await dbCommands.getEvent(eventID);
  } catch (error) {
    console.error('ownsEntity middleware ERROR: ', error);
    return res.status(404).render('error', { message: "We couldn't find the event you're trying to access." });
  }

  if (res.locals.username !== event.creator && res.locals.userRole !== 'admin') {
    console.log(
      `ownsEntity middleware ERROR: Permission denied to access event with ID ${eventID} for ${res.locals.username}!`,
    );
    return res.status(403).render('error', { message: 'Permission denied.' });
  }
  console.log(`ownsEntity middleware INFO: Access granted to event with ID ${eventID} for ${res.locals.username}!`);
  return next();
}
