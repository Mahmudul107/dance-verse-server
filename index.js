const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // mongodb
const jwt = require("jsonwebtoken"); // jsonwebtoken
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  //get bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.py1cfi4.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Collections
    const usersCollection = client.db("danceDB").collection("users");
    const classesCollection = client.db("danceDB").collection("classes");
    const selectedClassesCollection = client.db("danceDB").collection("selectedClasses");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };


    // Modify the verifyInstructor middleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // Class collection
    app.get("/classes", async (req, res) => {
      const query = { status: "Approved" };
      const filter = {
        sort: { enrolled_students: -1 },
      };
      const result = await classesCollection.find(query, filter).toArray();
      res.send(result);
    });

   
    // Get all classes
    app.get("/all-class", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // Approve or deny a class api
    app.patch("/class-status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.query.status;
      const query = { _id: new ObjectId(id) };
      const updatedStatus = {
        $set: {
          status: status,
        },
      };

      const result = await classesCollection.updateOne(query, updatedStatus);
      res.send(result);
    });

    // feedback api
    app.patch("/class-feedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body.feedback;

      const query = { _id: new ObjectId(id) };
      const updatedFeedback = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await classesCollection.updateOne(query, updatedFeedback);
      res.send(result);
    });


     // ------------------------ Student related api---------------------
    // select class
    app.post("/select-class", async (req, res) => {
      const selectedClassInfo = req.body;
      const result = await selectedClassesCollection.insertOne(
        selectedClassInfo
      );
      res.send(result);
    });

    app.get("/select-class", async (req, res) => {
      const classes = await selectedClassesCollection.find().toArray();
      res.send(classes);
    })

    // Get selected student's classes by email
    app.get("/select-class/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      // const query = { email: email };
      // console.log(query);
      const result = await selectedClassesCollection.find().toArray();
      console.log(result);
      res.send(result);
    });

    // Delete selected class
    app.delete("/select-class/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(query);
      res.send(result);
    });



    // users collection apis
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Creating users collection apis
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // first security check
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user.role === "admin" };
      res.send(result);
    });

    // Make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: `admin`,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // ----------------------Instructor API------------------------
    // Make instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: `instructor`,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user.role === "instructor" };
      res.send(result);
    });

     // Add a class
     app.post("/class", async (req, res) => {
      const classData = req.body;
      const result = await classesCollection.insertOne(classData);
      res.send(result);
    });
    

    // get all classes of instructor by email
    app.get("/class/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructor_email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    

    // ...

    // app.get("/users/instructor", verifyJWT, verifyAdmin, async (req, res) => {
    //   const query = { role: "instructor" };
    //   const instructors = await usersCollection.find(query).toArray();
    //   res.send(instructors);
    // });

    // Apply the verifyInstructor middleware to the /users/instructor endpoint
    // ...

    // Retrieve all instructors
    app.get("/users/instructor", async (req, res) => {
      const query = { role: "instructor" };
      // console.log(query);
      const instructors = await usersCollection.find(query).toArray();
      // console.log(instructors);
      res.send(instructors);
    });

     // get all classes of instructor by email
     app.get("/class/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructor_email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Website is dancing");
});

app.listen(port, () => {
  console.log(`Dance verse is already listening on port ${port}`);
});
