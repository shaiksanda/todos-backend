
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./models/users");
const Todo = require("./models/todos");
const path=require("path");
const cors = require('cors');
require('dotenv').config();



const app = express();
app.use(cors());

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

const authenticateToken=(req,res,next)=>{
  let jwtToken;
  const authHeader=req.headers['authorization']
  if(authHeader!==undefined){
    jwtToken=authHeader.split(" ")[1]
  }
  if (jwtToken===undefined) {
    res.status(401).send("Invalid Jwt Token");
  }
  else{
    jwt.verify(jwtToken,process.env.JWT_SECRET,(err,payload)=>{
      if (err){
        res.status(401).send("Invalid Jwt Token");
      }
      else{
        req.user={userId:payload.userId,username:payload.username}
        next()
      }
    })
  }

}


app.post("/todos", authenticateToken, async (req, res) => {
  try {
    const { todo, tag, priority } = req.body;
    const userId = req.user.userId;
    const addTodo = await Todo.create({ todo, tag, priority, userId });
    res.status(201).send({ message: "Todo Added successfully", todo: addTodo });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error adding todo", error: error.message });
  }
});



app.get("/todos", authenticateToken, async (req, res) => {
  const { tag, status,priority } = req.query; 
  
  const filter = {};
  if (tag) filter.tag = tag; 
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  try {
      
      const todos = await Todo.find(filter);
      
      
      res.send(todos);
  } catch (error) {
      res.status(500).send({ message: "Error retrieving todos", error: error.message });
  }
});

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
    await Todo.deleteMany({});
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
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (isPasswordMatched) {
      const userPayload = {
        userId: user._id,
        username: user.username,
        fullname: user.fullname,
        gender: user.gender,
      };
      const jwtToken = jwt.sign(userPayload, "SECRET_TOKEN", { expiresIn: '1h' });
      return res.status(200).json({ message: "Login successful", jwtToken, });
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
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
