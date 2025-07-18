const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
require('dotenv').config()
const stripe = require("stripe")("sk_test_51ReqVcI0N7JLD0W3LBH0NXzJlaUoCO87FXMRDizn4ZUqM3UZHlH20O23PH6swVLUmWxKUbKG2AZpxGeIrV2VQ2pd00eyzCxWjB")
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
    const paymentCollection = client.db("apartment").collection("payment")
    const announcementCollection = client.db("apartment").collection('announcement')
    const addCouponCollection = client.db('apartment').collection("addCoupons")


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

    // announcement post
    app.post('/announcement', async (req, res) => {
      const announce = req.body
      const result = await announcementCollection.insertOne(announce)
      res.send(result)
    })
    app.get('/announce', async (req, res) => {
      const result = await announcementCollection.find().toArray()
      res.send(result)
    })


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
    // agreement req get
    app.get('/agreements', async (req, res) => {
      const result = await agreementCollection.find().toArray()
      res.send(result)
    })
    // request accept
    app.patch('/agreements/accept/:id', async (req, res) => {
      const id = req.params.id;
      const agreement = await agreementCollection.findOne({ _id: new ObjectId(id) });
      const userUpdate = await usersCollection.updateOne(
        { email: agreement.userEmail },
        { $set: { role: "member" } }
      );
      const agreementUpdate = await agreementCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "checked" } }
      );
      res.send({ userUpdate, agreementUpdate });
    });


    // accept reject
    app.patch('/agreements/reject/:id', async (req, res) => {
      const id = req.params.id;
      const result = await agreementCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // agreement get
    app.get('/agreements/user/:email', async (req, res) => {
      const email = req.params.email;
      const result = await agreementCollection.find({
        userEmail: email,
        status: "checked"
      }).toArray();
      res.send(result);
    });
    // rent payment
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });
    // coupon post
    app.post("/addcoupons", async (req, res) => {
      const newCoupon = req.body;
      const result = await addCouponCollection.insertOne(newCoupon);
      res.send(result)
    });
    // get coupons

    app.get('/addcoupons', async (req, res) => {
      const result = await addCouponCollection.find().toArray();
      res.send(result);

    });



    app.get('/addcoupons/:code', async (req, res) => {
      const code = req.params.code;
      const result = await addCouponCollection.findOne({ code: code });
      res.send(result);
    });

    // stripe payment
    app.get('/apartinfo/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const apartment = await apartInfoCollection.findOne({
          _id: new ObjectId(id)
        });

        if (!apartment) {
          return res.status(404).send({ message: "Apartment not found" });
        }

        res.send(apartment);
      } catch (error) {
        res.status(500).send({ message: "Server Error", error: error.message });
      }
    });


    // payment intent apis create
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100)
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'BDT',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    });





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