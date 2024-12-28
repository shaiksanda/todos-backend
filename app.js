
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const redis=require("redis");
const User = require("./models/users");
const Todo = require("./models/todos");


const cors = require('cors');
require('dotenv').config();



const app = express();
app.use(cors());
const redisClient = redis.createClient({
  url: 'redis://red-ctn8t452ng1s73bi7mag:6379'
});
redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis successfully!");
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
};

connectRedis();

// MongoDB connection URI from environment variables

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB successfully!');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
};
connectToMongoDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const jwtToken = authHeader.split(" ")[1];

  if (!jwtToken) {
    return res.status(401).json({ message: "Invalid JWT Token" });
  }

  jwt.verify(jwtToken, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired JWT Token" });
    }

    req.user = { userId: payload.userId, username: payload.username };
    next();
  });
};


app.get("/todos", authenticateToken, async (req, res) => {
  const { tag, status, priority, selectedDate } = req.query;
  const userId = req.user.userId;
  const filter = {userId};

  // Add filters for tag, status, and priority if provided
  if (tag) filter.tag = tag;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  if (selectedDate) {
    // Only apply date filter if selectedDate is provided
    const date = new Date(selectedDate);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1); // Set nextDate to the start of the next day
    filter.selectedDate = { $gte: date.toISOString(), $lt: nextDate.toISOString() };
  }

  const cacheKey=JSON.stringify(filter)
  
  try {
    const cachedTodos = await redisClient.get(cacheKey);
    if(cachedTodos){
      return res.status(200).send(JSON.parse(cachedTodos));
    }
    const todos = await Todo.find(filter); // Find todos with applied filters
    await redisClient.setEx(cacheKey, 60*60*24*10,JSON.stringify(todos));
    res.status(200).send(todos);           // Send filtered todos
  } catch (error) {
    res.status(500).send({
      message: "Error retrieving todos",
      error: error.message,
    });
  }
});


app.post("/todos", authenticateToken, async (req, res) => {
  try {
    const { todo, tag, priority,selectedDate } = req.body;
    const userId = req.user.userId;
    const addTodo = await Todo.create({ todo, tag, priority, userId,selectedDate });
    res.status(201).send({ message: "Todo Added successfully", todo: addTodo });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error adding todo", error: error.message });
  }
});

app.get("/users", authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Extract userId from req.user
  try {
    const user = await User.findById(userId); // Query User model by userId
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    res.status(200).send(user); // Send user data if found
  } catch (error) {
    res.status(500).send({ message: "Error retrieving user", error: error.message });
  }
});




app.post('/forgotPassword',authenticateToken,async(req,res)=>{
  const {username,password}=req.body;
  try{
    const dbUser=await User.findOne({username})
  if(!dbUser){
    return res.status(404).json({message:"User not found"})
  }
  const isSamePassword=await bcrypt.compare(password,dbUser.password)
  if(isSamePassword){
    console.log("Your previous password is the same. Please use a different one.")
    return res.status(401).json({message:"Your previous password is the same. Please use a different one."})
  }
  const encryptedPassword=await bcrypt.hash(password,10)
  await User.findOneAndUpdate(dbUser._id,{$set:{password:encryptedPassword}},{new:true})
  return res.status(200).send({ message: "Password updated successfully!" });
  }
  catch(error){
    console.error(error)
    return res.status(500).send({  error_msg: "Error updating password" });
  }

})



app.put('/todos/:todoId',authenticateToken, async (req, res) => {
  const { todoId } = req.params;
  const { todo, tag, priority, status } = req.body;

  try {
    const updatedTodo = await Todo.findByIdAndUpdate(
      todoId,  
      {
        $set: { todo, tag, priority, status }
      },  
      { new: true }  // Option to return the updated document
    );

    if (!updatedTodo) {
      return res.status(404).send({ message: 'Todo not found' });
    }

    res.send({ message: 'Todo updated successfully', updatedTodo });
  } catch (error) {
    res.status(500).send({ message: 'Error updating todo', error: error.message });
  }
});


app.delete("/todos",authenticateToken, async (req, res) => {
  try {
    // Deletes all todos in the collection
    const userId = req.user.id;
    await Todo.deleteMany({ userId: userId });
    res.status(200).send({ message: "All todos deleted successfully" });
  } catch (error) {
    res.status(500).send({ message: "Error deleting todos", error: error.message });
  }
});


app.delete("/todos/:todoId",authenticateToken, async (req, res) => {
  const { todoId } = req.params;  // Extract todoId from the URL parameter
  
  try {
    // Delete the todo by its ID
    const deletedTodo = await Todo.findByIdAndDelete(todoId);
    
    // If no todo was found with that ID
    if (!deletedTodo) {
      return res.status(404).send({ message: "Todo not found" });
    }
    
    res.status(200).send({ message: "Todo deleted successfully", todo: deletedTodo });
  } catch (error) {
    res.status(500).send({ message: "Error deleting todo", error: error.message });
  }
});




app.post("/register", async (req, res) => {
  try {
    const { username, password, fullname, gender } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashedPassword,
      fullname,
      gender,
    });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Step 1: Check if user data is cached in Redis
    const cachedUser = await redisClient.get(`user:${username}`);
    let user;

    if (cachedUser) {
      console.log("Cache hit: User data retrieved from Redis");
      user = JSON.parse(cachedUser); // Parse cached user data
      
    } else {
      console.log("Cache miss: Fetching user data from MongoDB");

      // Step 2: Fetch user from MongoDB if not cached
      user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Step 3: Cache user data in Redis for future logins
      await redisClient.setEx(`user:${username}`, 60*60*24*10, JSON.stringify(user)); // Cache for 1 hour
    }

    // Step 4: Validate password (always validate, even for cached users)
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Step 5: Generate JWT token on successful login
    const userPayload = {
      userId: user._id,
      username: user.username,
      fullname: user.fullname,
      gender: user.gender,
    };

    const jwtToken = jwt.sign(userPayload, process.env.JWT_SECRET);

    return res.status(200).json({
      message: "Login successful",
      jwtToken,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ message: "Error logging in", error });
  }
});


const port = process.env.PORT || 3004;


app.get("/",(req, res) => {
  res.send("Hello, world! ,I successfully deployed my first backend application");
})

app.listen(port, () => {
  console.log("Server running");
});
