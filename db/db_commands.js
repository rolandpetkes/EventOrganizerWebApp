import { ObjectId } from 'mongodb';
import client from './connection.js';

function createEvent(eventName, eventStartDate, eventEndDate, eventLocation, creator) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  const event = {
    eventName,
    eventStartDate,
    eventEndDate,
    eventLocation,
    organizerList: [],
    imageList: [],
    creator,
    taskList: [],
  };
  return eventCollection.insertOne(event).then((result) => {
    console.log(`Event added with the following ID: ${result.insertedId}`);
    return result.insertedId;
  });
}

function addOrganizer(eventID, organizerName) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.updateOne({ _id: new ObjectId(String(eventID)) }, { $push: { organizerList: organizerName } });
}

function addImage(eventID, image) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.updateOne({ _id: new ObjectId(String(eventID)) }, { $push: { imageList: image } });
}

function removeOrganizer(eventID, organizerName) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.updateOne({ _id: new ObjectId(String(eventID)) }, { $pull: { organizerList: organizerName } });
}

function removeImage(eventID, filename) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.updateOne({ _id: new ObjectId(String(eventID)) }, { $pull: { imageList: { filename } } });
}

function getEvent(eventID) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.findOne({ _id: new ObjectId(String(eventID)) });
}

function getEvents() {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.find({}).toArray();
}

function getUsers() {
  const db = client.db('event_manager');
  const userCollection = db.collection('users');
  return userCollection.find({}).toArray();
}

function getUser(username) {
  const db = client.db('event_manager');
  const userCollection = db.collection('users');
  return userCollection.findOne({ username });
}

function createUser(username, email, password, role) {
  const db = client.db('event_manager');
  const userCollection = db.collection('users');
  return userCollection.insertOne({ username, email, password, role });
}

function updateUser(currentUsername, username, email, role) {
  const db = client.db('event_manager');
  const userCollection = db.collection('users');
  return userCollection.updateOne({ username: currentUsername }, { $set: { username, email, role } });
}

function deleteUser(username) {
  const db = client.db('event_manager');
  const userCollection = db.collection('users');
  return userCollection.deleteOne({ username });
}

function createTask(eventID, name, description, deadline, assignee) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  deadline = new Date(deadline);
  const dateCreated = new Date();
  return eventCollection.updateOne(
    { _id: new ObjectId(String(eventID)) },
    {
      $push: {
        taskList: {
          name,
          description,
          deadline,
          assignee,
          completed: false,
          stage: 'Created',
          dateCreated,
          dateLastModified: dateCreated,
          dateFinished: '',
        },
      },
    },
  );
}

function getTask(eventID, taskName) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.findOne({ _id: new ObjectId(String(eventID)) }).then((event) => {
    if (!event || !event.taskList) {
      return null;
    }
    return event.taskList.find((task) => task.name === taskName);
  });
}

function getTasks(eventID) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  return eventCollection.findOne({ _id: new ObjectId(String(eventID)) }).then((event) => event.taskList);
}

function updateTaskStage(eventID, taskName, stage) {
  const db = client.db('event_manager');
  const eventCollection = db.collection('events');
  const currentDate = new Date();
  if (stage === 'Finished') {
    return eventCollection.updateOne(
      { _id: new ObjectId(String(eventID)), 'taskList.name': taskName },
      {
        $set: {
          'taskList.$.stage': stage,
          'taskList.$.dateLastModified': currentDate,
          'taskList.$.dateFinished': currentDate,
          'taskList.$.completed': true,
        },
      },
    );
  }
  return eventCollection.updateOne(
    { _id: new ObjectId(String(eventID)), 'taskList.name': taskName },
    { $set: { 'taskList.$.stage': stage, 'taskList.$.dateLastModified': currentDate } },
  );
}

export default {
  createEvent,
  addOrganizer,
  addImage,
  removeOrganizer,
  removeImage,
  getEvent,
  getEvents,
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  createTask,
  getTask,
  getTasks,
  updateTaskStage,
};
