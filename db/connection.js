import { MongoClient, ServerApiVersion } from 'mongodb';

const uri =
  '<your connection string>';

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/*
async function insertExampleUsers() {
  try {
    const db = client.db('event_manager');
    const usersCollection = db.collection('users');

    const exampleUsers = [{ name: 'John' }, { name: 'Jane' }, { name: 'Mike' }, { name: 'Emily' }, { name: 'David' }];

    const result = await usersCollection.insertMany(exampleUsers);
    console.log(`${result.insertedCount} example users inserted successfully.`);
  } catch (err) {
    console.error(err);
  }
}
*/

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);
// insertExampleUsers().catch(console.dir);

export default client;
