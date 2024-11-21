const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema(
  {
    todo: {
      type: String,
      required: true,
      trim: true,
    },
    tag: 
      {
        type: String,
        trim: true,
      },
    
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
    
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Todo", todoSchema);
