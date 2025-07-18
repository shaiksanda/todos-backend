const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./models/users");
const Todo = require("./models/todos");

const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  const filter = { userId };

  if (tag) filter.tag = tag;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  if (selectedDate) {

    const date = new Date(selectedDate);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1); // Set nextDate to the start of the next day
    filter.selectedDate = { $gte: date, $lt: nextDate };
  }

  try {
    const todos = await Todo.find(filter);
    res.status(200).json(todos);           // Send filtered todos
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving todos",
      error: error.message,
    });
  }
});

app.post("/todos", authenticateToken, async (req, res) => {
  const { todo, tag, priority, selectedDate } = req.body;
  const userId = req.user.userId;

  const date = new Date(selectedDate);
  date.setHours(0, 0, 0, 0)

  try {
    const addTodo = await Todo.create({ todo, tag, priority, userId, selectedDate: date });
    res.status(201).json({ message: "Todo added successfully", todo: addTodo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding todo", error: error.message });
  }
});

app.get("/users", authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Extract userId from req.user
  try {
    const user = await User.findById(userId); // Query User model by userId
    if (user.role === "admin") {
      let allUsers = await User.find({}, { _id: 0 })
      res.status(200).json(allUsers)
    }
    else {
      res.status(403).json({ message: "Forbidden: Admins only" })
    }

  } catch (error) {
    res.status(500).json({ message: "Error retrieving user", error: error.message });
  }
});

app.post('/forgotPassword', async (req, res) => {
  const { username, password } = req.body;
  try {
    const dbUser = await User.findOne({ username })
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" })
    }
    const isSamePassword = await bcrypt.compare(password, dbUser.password)
    if (isSamePassword) {
      return res.status(401).json({ message: "Your previous password is the same. Please use a different one." })
    }
    const encryptedPassword = await bcrypt.hash(password, 10)
    await User.findOneAndUpdate({ _id: dbUser._id }, { password: encryptedPassword }, { new: true })
    return res.status(200).json({ message: "Password updated successfully!" });
  }
  catch (error) {
    console.error(error)
    return res.status(500).json({ error_msg: "Error updating password" });
  }

})

app.put('/todos/:todoId', authenticateToken, async (req, res) => {
  const { todoId } = req.params;
  const { todo, tag, priority, status, selectedDate } = req.body;
  const date = new Date(selectedDate);
  date.setHours(0, 0, 0, 0);
  try {
    const updatedTodo = await Todo.findByIdAndUpdate(
      todoId,
      { todo, tag, priority, status, selectedDate: date },
      { new: true }
    );

    if (!updatedTodo) {
      return res.status(404).send({ message: 'Todo not found' });
    }
    res.status(200).json({ message: 'Todo updated successfully', updatedTodo });
  } catch (error) {
    res.status(500).json({ message: 'Error updating todo', error: error.message });
  }
});

app.delete("/todos", authenticateToken, async (req, res) => {
  try {
    // Deletes all todos in the collection
    const userId = req.user.userId;
    await Todo.deleteMany({ userId });
    res.status(200).json({ message: "All todos deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting todos", error: error.message });
  }
});

app.delete("/todos/:todoId", authenticateToken, async (req, res) => {
  const { todoId } = req.params;  // Extract todoId from the URL parameter
  const userId = req.user.userId;
  try {
    // Delete the todo by its ID
    const deletedTodo = await Todo.findOneAndDelete({ _id: todoId, userId });
    if (!deletedTodo) {
      return res.status(404).send({ message: "Todo not found or unauthorized" });
    }
    res.status(200).json({ message: "Todo deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Error deleting todo", error: error.message });
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
    res.status(201).json({ message: "User registered successfully!", });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Step 1: Find user in MongoDB
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Step 2: Compare password
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Step 3: Create JWT payload
    const userPayload = {
      userId: user._id,
      username: user.username,
      fullname: user.fullname,
      gender: user.gender,
    };

    // Step 4: Generate token
    const jwtToken = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Step 5: Send response
    return res.status(200).json({
      message: "Login successful",
      jwtToken,
    });

  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ message: "Error logging in", error });
  }
});

app.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user
    const { days } = req.query
    let filter = { userId }

    let today = new Date()
    today.setHours(0, 0, 0, 0)

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - parseInt(days));

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 1);

    filter.selectedDate = {
      $gte: startDate,
      $lt: endDate
    };

    const todos = await Todo.find(filter)
    const aggregatedTodos = await Todo.aggregate([{ $match: { userId, selectedDate: { $gte: startDate, $lt: endDate }, status: "completed" } }, { $group: { _id: "$selectedDate", count: { $sum: 1 } } }, { $project: { _id: 0, date: "$_id", count: 1 } }, {
      $sort: { date: 1 }
    }])

    let pendingTodos = completedTodos = 0
    let high = low = medium = 0
    todos.forEach(each => {
      if (each.status === "pending") {
        pendingTodos++
      }
      else {
        completedTodos++
      }
      if (each.priority === "high") {
        high++
      }
      else if (each.priority === 'low') {
        low++
      }
      else {
        medium++
      }
    })
    const graph1_status_breakdown = { totalTodos: todos.length, pendingTodos, completedTodos }
    const graph2_priority_breakdown = { high, low, medium }
    res.status(200).json({ graph1_status_breakdown, graph2_priority_breakdown, graph3_completion_trend: aggregatedTodos })
  }
  catch (err) {
    res.status(500).json({ error: err.message })
  }

})

const port = process.env.PORT || 3004;


app.get("/", (req, res) => {
  res.send("Hello, world! ,I successfully deployed my first backend application");
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
