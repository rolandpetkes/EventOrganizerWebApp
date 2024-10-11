import express from 'express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import bodyparser from 'body-parser';
import requestRoutes from './routes/events.js';
import userRoutes from './routes/users.js';
import userInfo from './middlewares/userInfo.js';

const app = express();
const port = 8080;

app.use(express.urlencoded({ extended: true }));
app.use(bodyparser.json());
app.use(cookieParser());
app.use(userInfo);

app.use(express.static('public/front-end'));
app.use(express.static('uploaded_images'));

app.set('view engine', 'ejs');
app.set('views', join(process.cwd(), 'views'));

app.use('/', requestRoutes);
app.use('/', userRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
