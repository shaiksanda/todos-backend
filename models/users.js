const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  fullname: { type: String },
  gender: { type: String },
  role:{type:String,enum:["admin","user"],
    default:"user"
  }
  
},  { timestamps: true });

module.exports = mongoose.model("User", userSchema)