const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  fullname: { type: String },
  gender: { type: String },
  
},  { timestamps: true });

module.exports = mongoose.model("User", userSchema)