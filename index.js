const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase admin SDK
const serviceAccount = require("./building-management-firebase-adminsdk-fbsvc.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lspa3gf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Token verification middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(403).send({ message: "Forbidden", error });
  }
};

async function run() {
  try {
    // await client.connect();

    const apartInfoCollection = client.db("apartment").collection("apartInfo");
    const agreementCollection = client.db("apartment").collection("agreements");
    const usersCollection = client.db("apartment").collection("users");
    const paymentCollection = client.db("apartment").collection("payment");
    const announcementCollection = client.db("apartment").collection('announcement');
    const addCouponCollection = client.db('apartment').collection("addCoupons");

    // Get all apartments
    app.get("/apartinfo", async (req, res) => {
      const apartments = await apartInfoCollection.find().toArray();
      res.send(apartments);
    });

    // Get single apartment by ID
    app.get('/apartinfo/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const apartment = await apartInfoCollection.findOne({ _id: new ObjectId(id) });
        if (!apartment) return res.status(404).send({ message: "Apartment not found" });
        res.send(apartment);
      } catch (error) {
        res.status(500).send({ message: "Server Error", error: error.message });
      }
    });

    // Agreements
    app.post('/agreement', verifyToken, async (req, res) => {
      const data = req.body;
      const existing = await agreementCollection.findOne({
        userEmail: data.userEmail,
        apartmentNo: data.apartmentNo
      });
      if (existing) return res.status(400).send({ message: 'Agreement already submitted by this user.' });
      const result = await agreementCollection.insertOne(data);
      res.send(result);
    });

    app.get('/agreements', verifyToken, async (req, res) => {
      const result = await agreementCollection.find().toArray();
      res.send(result);
    });

    app.get('/agreements/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) return res.status(403).send({ message: 'forbidden access' });
      const result = await agreementCollection.find({ userEmail: email, status: "checked" }).toArray();
      res.send(result);
    });

    app.patch('/agreements/accept/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const agreement = await agreementCollection.findOne({ _id: new ObjectId(id) });
      const userUpdate = await usersCollection.updateOne({ email: agreement.userEmail }, { $set: { role: "member" } });
      const agreementUpdate = await agreementCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "checked" } });
      res.send({ userUpdate, agreementUpdate });
    });

    app.patch('/agreements/reject/:id', async (req, res) => {
      const id = req.params.id;
      const result = await agreementCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Users
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/role/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) return res.status(403).send({ message: 'forbidden access' });
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.patch("/users/role-user/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: "user" } };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Announcements
    app.post('/announcement', async (req, res) => {
      const announce = req.body;
      const result = await announcementCollection.insertOne(announce);
      res.send(result);
    });

    app.get('/announce', async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result);
    });

    // Coupons
    app.post("/addcoupons", async (req, res) => {
      const newCoupon = req.body;
      const result = await addCouponCollection.insertOne(newCoupon);
      res.send(result);
    });

    app.get('/addcoupons', async (req, res) => {
      const result = await addCouponCollection.find().toArray();
      res.send(result);
    });

    app.get('/addcoupons/:code', async (req, res) => {
      const code = req.params.code;
      const result = await addCouponCollection.findOne({ code });
      res.send(result);
    });

    app.patch("/addcoupons/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      try {
        const result = await addCouponCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update coupon status", error });
      }
    });

    // Payments
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'BDT',
        payment_method_types: ['card'],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.get('/paymenthistory', verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) return res.status(403).send({ message: 'forbidden access' });
      const query = email ? { email } : {};
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    console.log("MongoDB connected successfully!");
  } finally {
    // client.close() if needed
  }
}

run().catch(console.dir);

// Default route
app.get("/", (req, res) => {
  res.send("Building Management Server Is Running...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
