import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import dbCommands from '../db/db_commands.js';
import isLoggedIn from '../middlewares/isLoggedIn.js';
import checkPriviliges from '../middlewares/checkPriviliges.js';

const JWT_SECRET = 'suPerSEcReT';

const router = express.Router();
const upload = multer();

router.get('/login', (req, res) => {
  res.status(200).render('login', { message: '', type: 'success' });
});

router.get('/logout', isLoggedIn, (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

router.get('/register', (req, res) => {
  res.status(200).render('register', { message: '', type: 'success' });
});

router.get('/userManagement', isLoggedIn, checkPriviliges('admin'), async (req, res) => {
  try {
    const users = await dbCommands.getUsers();
    const usernames = users.map((user) => user.username);
    res.status(200).render('userManagement', { message: '', type: '', usernames });
  } catch (err) {
    res.status(500).render('error', { message: `Selection unsuccessful: ${err.message}` });
  }
});

router.get('/api/users', isLoggedIn, checkPriviliges('admin'), async (req, res) => {
  try {
    const users = await dbCommands.getUsers();
    const usernames = users.map((user) => user.username);
    return res.status(200).json(usernames);
  } catch (err) {
    return res.status(500).json({ error: `Selection unsuccessful: ${err.message}` });
  }
});

router.get('/api/userDetails/:username', isLoggedIn, checkPriviliges('admin'), async (req, res) => {
  const { username } = req.params;
  const user = await dbCommands.getUser(username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.status(200).json(user);
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await dbCommands.getUser(username);
    if (!user) {
      return res.status(401).render('login', { message: 'Invalid username or password', type: 'error' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).render('login', { message: 'Invalid username or password', type: 'error' });
    }
    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    return res.status(200).redirect('/');
  } catch (error) {
    return res.status(500).render('error', { message: `Login unsuccessful: ${error.message}` });
  }
});

router.post('/api/register', upload.none(), async (req, res) => {
  const { username, email, password, password2 } = req.body;

  try {
    if (password !== password2) {
      return res.status(400).json();
    }

    const user = await dbCommands.getUser(username);
    if (user) {
      return res.status(409).json();
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await dbCommands.createUser(username, email, hashedPassword, 'unapproved');
    return res.status(200).json();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: `Registration unsuccessful: ${error.message}` });
  }
});

router.post('/api/userDetails/:currentUsername', isLoggedIn, checkPriviliges('admin'), async (req, res) => {
  const { currentUsername } = req.params;
  const { username, email, role } = req.body;
  try {
    let user = await dbCommands.getUser(currentUsername);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user = await dbCommands.getUser(username);
    if (currentUsername !== username && user) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    await dbCommands.updateUser(currentUsername, username, email, role);
    return res.status(200).json({ message: 'User details updated successfully' });
  } catch (error) {
    return res.status(500).json({ error: `Update unsuccessful: ${error.message}` });
  }
});

router.delete('/api/userDetails/:username', isLoggedIn, checkPriviliges('admin'), async (req, res) => {
  const { username } = req.params;
  try {
    const user = await dbCommands.getUser(username);
    if (!user) {
      return res.status(404).json();
    }
    await dbCommands.deleteUser(username);
    return res.status(200).json();
  } catch (error) {
    return res.status(500).json({ error: `Deletion unsuccessful: ${error.message}` });
  }
});

export default router;
