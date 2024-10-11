import express from 'express';
import path from 'path';
import multer from 'multer';
import { unlinkSync, existsSync, mkdirSync, renameSync } from 'fs';
import dbCommands from '../db/db_commands.js';
import isLoggedIn from '../middlewares/isLoggedIn.js';
import ownsEntity from '../middlewares/ownsEntity.js';
import checkPriviliges from '../middlewares/checkPriviliges.js';

const router = express.Router();

const uploadDir = './uploaded_images';
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir);
}
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

router.get('/', async (req, res) => {
  try {
    const events = await dbCommands.getEvents();
    res.status(200).render('events', { events });
  } catch (err) {
    res.status(500).render('error', { message: `Selection unsuccessful: ${err.message}` });
  }
});

router.get('/createEvent', isLoggedIn, checkPriviliges('admin', 'organizer'), async (req, res) => {
  if (res.locals.userRole === 'admin') {
    try {
      let users = await dbCommands.getUsers();
      users = users.filter((user) => user.role === 'organizer');
      res.status(200).render('createEvent', { message: '', type: 'success', users });
    } catch (err) {
      res.status(500).render('error', { message: `Error: ${err.message}` });
    }
  } else {
    res.status(200).render('createEvent', { message: '', type: 'success' });
  }
});

router.get('/eventDetails/:id', async (req, res) => {
  const eventID = req.params.id;

  try {
    const event = await dbCommands.getEvent(eventID);
    if (!event) {
      return res.status(404).render('error', { message: `Event with ID ${eventID} not found` });
    }
    const tasks = await dbCommands.getTasks(eventID);
    if (!tasks) {
      return res.status(404).render('error', { message: `Tasks for event with ID ${eventID} not found` });
    }
    return res.status(200).render('eventDetails', { message: '', type: '', event, tasks });
  } catch (err) {
    return res.status(500).render('error', { message: 'Internal server error' });
  }
});

router.get('/api/events', async (req, res) => {
  try {
    const events = await dbCommands.getEvents();
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/eventDetails/:id', async (req, res) => {
  const eventId = req.params.id;
  let event;

  if (!eventId || !eventId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid Event ID' });
  }
  try {
    event = await dbCommands.getEvent(eventId);
  } catch (error) {
    console.error('Event details route ERROR: ', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (event) {
    return res.status(200).json({
      location: event.eventLocation,
      startDate: event.eventStartDate,
      endDate: event.eventEndDate,
      organizers: event.organizerList,
    });
  }
  return res.status(404).json({ error: 'Event not found' });
});

router.get('/api/tasks/:eventID', isLoggedIn, checkPriviliges('admin', 'organizer'), async (req, res) => {
  const { eventID } = req.params;

  if (!eventID || !eventID.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid Event ID' });
  }
  try {
    const tasks = await dbCommands.getTasks(eventID);
    if (!tasks) {
      return res.status(404).json({ error: 'Tasks not found' });
    }
    return res.status(200).json(tasks);
  } catch (error) {
    console.error('Tasks route ERROR: ', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get(
  '/api/taskDetails/:eventID/:taskName',
  isLoggedIn,
  checkPriviliges('admin', 'organizer'),
  async (req, res) => {
    const { eventID, taskName } = req.params;

    if (!eventID || !eventID.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid Event ID' });
    }

    try {
      const task = await dbCommands.getTask(eventID, taskName);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      if (task.stage === 'Finished') {
        return res.status(200).json({ dateFinished: new Date(task.dateFinished).toLocaleString() });
      }
      const response = {
        dateCreated: new Date(task.dateCreated).toLocaleString(),
        dateLastModified: new Date(task.dateLastModified).toLocaleString(),
        description: task.description,
        stage: task.stage,
        assignee: task.assignee,
      };
      return res.status(200).json(response);
    } catch (error) {
      console.error('Task details route ERROR: ', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

router.delete('/api/images/:eventID/:filename', isLoggedIn, ownsEntity, async (req, res) => {
  const { eventID, filename } = req.params;

  try {
    const result = await dbCommands.removeImage(eventID, filename);

    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'Event not found' });
    } else if (result.modifiedCount === 0) {
      res.status(404).json({ error: 'Image not found' });
    } else {
      console.log('Image delete route INFO: image deleted successfully');
      unlinkSync(path.join(uploadDir, filename));
      res.status(200).json();
    }
  } catch (error) {
    console.error('Image delete route ERROR: ', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const validateDates = (eventStartDate, eventEndDate, users, res) => {
  const startDate = new Date(eventStartDate);
  const endDate = new Date(eventEndDate);
  if (startDate.toString() === 'Invalid Date' || endDate.toString() === 'Invalid Date') {
    console.log('Event creation form ERROR: Incorrect date format!');
    return res.status(400).render('createEvent', { message: 'Incorrect date format', type: 'error', users });
  }

  if (eventEndDate < eventStartDate) {
    console.log('Event creation form ERROR: Incorrect date!');
    return res.status(400).render('createEvent', {
      message: 'Event end date must be greater than or equal to the start date',
      type: 'error',
      users,
    });
  }
  return null;
};

router.post('/event-creation-form', isLoggedIn, checkPriviliges('admin', 'organizer'), async (req, res) => {
  let eventName;
  let eventStartDate;
  let eventEndDate;
  let eventLocation;
  let creator;

  if (res.locals.userRole === 'admin') {
    ({ eventName, eventStartDate, eventEndDate, eventLocation, creator } = req.body);
  } else {
    ({ eventName, eventStartDate, eventEndDate, eventLocation } = req.body);
  }

  let users = await dbCommands.getUsers();
  users = users.filter((user) => user.role === 'organizer');

  if (res.locals.userRole !== 'admin' && creator) {
    console.log('Event creation form ERROR: Unauthorized access!');
    return res.status(403).render('createEvent', { message: 'Unauthorized access', type: 'error', users });
  }

  if (!eventName || !eventStartDate || !eventEndDate || !eventLocation) {
    console.log('Event creation form ERROR: Fields incomplete!');
    return res.status(400).render('createEvent', { message: 'All fields are required', type: 'error', users });
  }

  const errorResponse = validateDates(eventStartDate, eventEndDate, users, res);
  if (errorResponse) return errorResponse;

  try {
    const insertedID = await dbCommands.createEvent(
      eventName,
      eventStartDate,
      eventEndDate,
      eventLocation,
      res.locals.userRole === 'admin' ? creator : res.locals.username,
    );

    console.log(`Event creation form INFO: Event added successfuly with ID ${insertedID}!`);
    return res.redirect('/');
  } catch (error) {
    console.error('Event creation form ERROR: ', error);
    return res.status(500).render('createEvent', { message: 'Event creation unsuccessful', type: 'error', users });
  }
});

router.post('/organizer-joining-form', isLoggedIn, checkPriviliges('admin', 'organizer'), async (req, res) => {
  const { eventID } = req.body;

  let event;
  const tasks = await dbCommands.getTasks(eventID);
  if (!tasks) {
    return res.status(404).render('error', { message: `Tasks for event with ID ${eventID} not found` });
  }
  if (!eventID) {
    console.log('Organizer joining form ERROR: Fields incomplete!');
    return res.status(400).render('eventDetails', { message: 'All fields are required', type: 'error', event, tasks });
  }
  try {
    event = await dbCommands.getEvent(eventID);
  } catch (error) {
    console.error('Organizer joining form ERROR: ', error);
    return res.status(500).render('error', { message: `Selection unsuccessful: ${error.message}` });
  }

  if (!event) {
    console.log(`Organizer joining form ERROR: Event with ID ${eventID} not found!`);
    return res
      .status(404)
      .render('eventDetails', { message: `Event with ID ${eventID} not found`, type: 'error', event, tasks });
  }

  if (req.body.action === 'join') {
    if (event.organizerList.includes(res.locals.username)) {
      console.log(`Organizer joining form ERROR: Already an organizer of the event with ID ${eventID}!`);
      return res.status(400).render('eventDetails', {
        message: `You are already an organizer of the event with ID ${eventID}!`,
        type: 'error',
        event,
        tasks,
      });
    }

    try {
      await dbCommands.addOrganizer(eventID, res.locals.username);
      event = await dbCommands.getEvent(eventID);
    } catch (error) {
      console.error('Organizer joining form ERROR: ', error);
      return res.status(500).render('error', { message: `Update unsuccessful: ${error.message}` });
    }

    console.log(`Organizer joining form INFO: Organizer added successfully to the event with ID ${eventID}!`);
    return res.status(200).render('eventDetails', {
      message: `You successfully joined the event ${event.eventName}!`,
      type: 'success',
      event,
      tasks,
    });
  }
  if (!event.organizerList.includes(res.locals.username)) {
    console.log(`Organizer joining form ERROR: You're not an organizer of the event with ID ${eventID}!`);
    return res.status(400).render('eventDetails', {
      message: `You are not an organizer of the event with ID ${eventID}!`,
      type: 'error',
      event,
      tasks,
    });
  }

  try {
    await dbCommands.removeOrganizer(eventID, res.locals.username);
    event = await dbCommands.getEvent(eventID);
  } catch (error) {
    console.error('Organizer joining form ERROR: ', error);
    return res.status(500).render('error', { message: `Update unsuccessful: ${error.message}` });
  }

  console.log(`Organizer joining form INFO: Organizer removed successfully from the event with ID ${eventID}!`);
  return res.status(200).render('eventDetails', {
    message: `You successfully left the event ${event.eventName}!`,
    type: 'success',
    event,
    tasks,
  });
});

async function handleImageUpload(eventID, image, event, tasks, res) {
  if (!eventID || !image) {
    console.log('Image upload form ERROR: Fields incomplete!');
    if (image) {
      unlinkSync(path.join(uploadDir, image.filename));
    }
    return res.status(400).render('eventDetails', { message: 'All fields are required', type: 'error', event, tasks });
  }

  if (!event) {
    console.log(`Image upload form ERROR: Event with ID ${eventID} not found!`);
    if (image) {
      unlinkSync(path.join(uploadDir, image.filename));
    }
    return res
      .status(404)
      .render('eventDetails', { message: `Event with ID ${eventID} not found`, type: 'error', event, tasks });
  }

  if (res.locals.username !== event.creator && res.locals.userRole !== 'admin') {
    console.log(`Image upload form ERROR: ${res.locals.username} is not the creator of the event with ID ${eventID}!`);
    if (image) {
      unlinkSync(path.join(uploadDir, image.filename));
    }
    return res.status(400).render('eventDetails', {
      message: `${res.locals.username} is not the creator of the event with ID ${eventID}!`,
      type: 'error',
      event,
      tasks,
    });
  }

  if (!image.mimetype.startsWith('image/')) {
    console.log(`Image upload form ERROR: ${image.filename} is not an image!`);
    unlinkSync(path.join(uploadDir, image.filename));
    return res
      .status(400)
      .render('eventDetails', { message: `${image.filename} is not an image!`, type: 'error', event, tasks });
  }
  const oldPath = path.join(uploadDir, image.filename);
  const newPath = path.join(uploadDir, `${image.filename}${path.extname(image.originalname)}`);
  renameSync(oldPath, newPath);
  image.filename = `${image.filename}${path.extname(image.originalname)}`;

  try {
    await dbCommands.addImage(eventID, image);
  } catch (error) {
    console.error('Image upload form ERROR: ', error);
    return res.status(500).render('error', { message: `Update unsuccessful: ${error.message}` });
  }

  console.log(
    `Image upload form INFO: ${image.filename}(${image.originalname}) added successfully to the event with ID ${eventID}!`,
  );
  event = await dbCommands.getEvent(eventID);
  return res.status(200).render('eventDetails', {
    message: `${image.originalname} added successfully to the event ${event.eventName}!`,
    type: 'success',
    event,
    tasks,
  });
}

router.post(
  '/image-upload-form',
  isLoggedIn,
  upload.single('image'),
  ownsEntity,
  checkPriviliges('admin', 'organizer'),
  async (req, res) => {
    const { eventID } = req.body;
    const image = req.file;
    let event;

    try {
      event = await dbCommands.getEvent(eventID);
    } catch (error) {
      console.error('Image upload form ERROR: ', error);
      return res.status(500).render('error', { message: `Selection unsuccessful: ${error.message}` });
    }

    const tasks = await dbCommands.getTasks(eventID);
    if (!tasks) {
      return res.status(404).render('error', { message: `Tasks for event with ID ${eventID} not found` });
    }

    return handleImageUpload(eventID, image, event, tasks, res);
  },
);

router.post('/api/createTask', isLoggedIn, checkPriviliges('admin'), upload.none(), async (req, res) => {
  const { eventID, taskName, taskAssignee, taskDeadline, taskDescription } = req.body;

  if (!eventID || !taskName || !taskAssignee || !taskDeadline || !taskDescription) {
    return res.status(400).json();
  }
  const event = await dbCommands.getEvent(eventID);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  const task = await dbCommands.getTask(eventID, taskName);
  if (task) {
    return res.status(409).json();
  }
  if (new Date(taskDeadline).toString() === 'Invalid Date') {
    return res.status(400).json();
  }
  if (new Date(taskDeadline) < new Date()) {
    return res.status(400).json();
  }

  try {
    await dbCommands.createTask(eventID, taskName, taskDescription, taskDeadline, taskAssignee);
    return res.status(200).json();
  } catch (error) {
    console.error('Task creation form ERROR: ', error);
    return res.status(500).json({ error: `Task creation unsuccessful: ${error.message}` });
  }
});

router.post('/api/updateTask', isLoggedIn, checkPriviliges('admin', 'organizer'), upload.none(), async (req, res) => {
  const { eventID, taskName, stage } = req.body;
  console.log(eventID, taskName, stage);
  if (!eventID || !taskName || !stage) {
    return res.status(400).json();
  }
  const event = await dbCommands.getEvent(eventID);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  const task = await dbCommands.getTask(eventID, taskName);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (task.assignee !== res.locals.username && res.locals.userRole !== 'admin') {
    return res.status(403).json({ error: 'Permission denied' });
  }

  try {
    await dbCommands.updateTaskStage(eventID, taskName, stage);
    return res.status(200).json();
  } catch (error) {
    console.error('Task update form ERROR: ', error);
    return res.status(500).json({ error: `Task update unsuccessful: ${error.message}` });
  }
});

export default router;
