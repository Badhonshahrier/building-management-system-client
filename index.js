const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lspa3gf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const apartInfoCollection = client.db("apartment").collection("apartInfo")
    const agreementCollection = client.db("apartment").collection("agreements")
    const usersCollection = client.db("apartment").collection
      ("users")


    app.get("/apartinfo", async (req, res) => {
      const apartments = await apartInfoCollection.find().toArray()
      res.send(apartments)
    })


    app.post('/agreement', async (req, res) => {
      const data = req.body;
      const existing = await agreementCollection.findOne({ userEmail: data.userEmail });
      const result = await agreementCollection.insertOne(data);
      res.send(result);
    });

    // users collection
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // user get
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // role checked
    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email
      const user = await usersCollection.findOne({ email })
      res.send(user)
    })
    // role status changed
    app.patch("/users/role-user/:id", async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: "user"
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })







    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);












app.get("/", (req, res) => {
  res.send("Building Management Server Is Running...")
})
app.listen(port, () => {
  console.log(`Building Management Server Is Running On The Port ${port}`)
})